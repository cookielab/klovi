import { Text } from "@cookielab.io/klovi-design-system";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Badge } from "./Badge/Badge";
import { Button } from "./Button/Button";
import { Collapsible } from "./Collapsible/Collapsible";
import { Input } from "./FormControls/Input";
import { SegmentedControl } from "./FormControls/SegmentedControl";
import { Select } from "./FormControls/Select";
import { Toggle } from "./FormControls/Toggle";
import { AppLayout } from "./Layout/AppLayout";
import { ContentHeader } from "./Layout/ContentHeader";
import { Sidebar } from "./Layout/Sidebar";
import { SidebarButton } from "./Layout/SidebarButton";
import { Modal } from "./Modal/Modal";



const N_640 = 640;

const T_SAVE = "Save";
const T_HIDDEN_CONTENT = "Hidden content";
const T_INNER = "Inner";
const T_CLOSED = "Closed";
const T_NAME = "Name";
const T_THEME = "Theme";
const T_MENU = "Menu";
const T_MAIN_CONTENT = "Main content";
const T_SEARCH = "Search";
const T_DEFAULT = "Default";
const T_PLAN = "Plan";

const DETAILS_BUTTON_NAME = /details/iu;

afterEach(cleanup);

describe("design-system components", () => {
	it("Button forwards props and handles clicks", () => {
		const onClick = mock(() => undefined);

		const { getByRole } = render(
			<Button variant="primary" size="sm" icon={true} className="custom" onClick={onClick}>
				<Text>{T_SAVE}</Text>
			</Button>,
		);

		const button = getByRole("button", { name: "Save" }) as HTMLButtonElement;
		expect(button.type).toBe("button");
		expect(button.className).toContain("custom");

		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("Collapsible toggles content visibility", () => {
		const { queryByText, getByRole } = render(
			<Collapsible title="Details">
				<div><Text>{T_HIDDEN_CONTENT}</Text></div>
			</Collapsible>,
		);

		expect(queryByText("Hidden content")).toBeNull();

		fireEvent.click(getByRole("button", { name: DETAILS_BUTTON_NAME }));
		expect(queryByText("Hidden content")).toBeTruthy();

		fireEvent.click(getByRole("button", { name: DETAILS_BUTTON_NAME }));
		expect(queryByText("Hidden content")).toBeNull();
	});

	it("Modal handles overlay clicks, escape, and inner click propagation", () => {
		const onClose = mock(() => undefined);

		const { getByRole, getByText, rerender } = render(
			<Modal open={true} onClose={onClose} width={N_640}>
				<button type="button"><Text>{T_INNER}</Text></button>
			</Modal>,
		);

		const dialog = getByRole("dialog") as HTMLDivElement;
		expect(dialog.style.width).toBe("640px");

		fireEvent.click(getByText("Inner"));
		expect(onClose).toHaveBeenCalledTimes(0);

		const overlay = dialog.parentElement;
		if (!overlay) {
			throw new Error("Missing modal overlay");
		}
		fireEvent.click(overlay);
		expect(onClose).toHaveBeenCalledTimes(1);

		globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(onClose).toHaveBeenCalledTimes(2);

		rerender(
			<Modal open={false} onClose={onClose}>
				<div><Text>{T_CLOSED}</Text></div>
			</Modal>,
		);

		globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("SegmentedControl respects value, onChange, and disabled state", () => {
		const onChange = mock(() => undefined);

		const { getByRole, rerender } = render(
			<SegmentedControl
				value="light"
				onChange={onChange}
				options={[
					{ value: "light", label: "Light" },
					{ value: "dark", label: "Dark" },
				]}
			/>,
		);

		fireEvent.click(getByRole("button", { name: "Dark" }));
		expect(onChange).toHaveBeenCalledWith("dark");

		rerender(
			<SegmentedControl
				value="light"
				onChange={onChange}
				disabled={true}
				options={[
					{ value: "light", label: "Light" },
					{ value: "dark", label: "Dark" },
				]}
			/>,
		);

		fireEvent.click(getByRole("button", { name: "Dark" }));
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("Input, Select, and Toggle render and wire through props", () => {
		let inputChanges = 0;
		let selectChanges = 0;
		const onToggle = mock((_checked: boolean) => undefined);

		const { getByLabelText, getByRole } = render(
			<div>
				<label htmlFor="name"><Text>{T_NAME}</Text></label>
				<Input
					id="name"
					value="Jane"
					onChange={() => {
						inputChanges += 1;
					}}
				/>

				<label htmlFor="theme"><Text>{T_THEME}</Text></label>
				<Select
					id="theme"
					value="light"
					onChange={() => {
						selectChanges += 1;
					}}
					options={[
						{ value: "light", label: "Light" },
						{ value: "dark", label: "Dark" },
					]}
				/>

				<Toggle checked={true} onChange={onToggle} label="Enabled" />
			</div>,
		);

		const input = getByLabelText("Name") as HTMLInputElement;
		const select = getByLabelText("Theme") as HTMLSelectElement;
		const toggle = getByRole("checkbox", { name: "Enabled" }) as HTMLInputElement;

		fireEvent.change(input, { target: { value: "John" } });
		fireEvent.change(select, { target: { value: "dark" } });
		fireEvent.click(toggle);

		expect(inputChanges).toBe(1);
		expect(selectChanges).toBe(1);
		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it("layout primitives render expected sections", () => {
		const { getByText } = render(
			<AppLayout
				sidebar={
					<Sidebar header="Top" footer="Bottom">
						<Text>{T_MENU}</Text>
					</Sidebar>
				}
				hideSidebar={true}
			>
				<ContentHeader left="Left" right="Right" />
				<div><Text>{T_MAIN_CONTENT}</Text></div>
			</AppLayout>,
		);

		expect(getByText("Top")).toBeTruthy();
		expect(getByText("Menu")).toBeTruthy();
		expect(getByText("Bottom")).toBeTruthy();
		expect(getByText("Left")).toBeTruthy();
		expect(getByText("Right")).toBeTruthy();
		expect(getByText("Main content")).toBeTruthy();
	});

	it("SidebarButton renders as a button and forwards props", () => {
		const onClick = mock(() => undefined);
		const { getByRole } = render(
			<SidebarButton onClick={onClick} title="Search">
				<Text>{T_SEARCH}</Text>
			</SidebarButton>,
		);

		const button = getByRole("button", { name: "Search" }) as HTMLButtonElement;
		expect(button.type).toBe("button");
		expect(button.title).toBe("Search");

		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("Badge renders content for multiple variants", () => {
		const { getByText, rerender } = render(<Badge><Text>{T_DEFAULT}</Text></Badge>);
		expect(getByText("Default")).toBeTruthy();

		rerender(
			<Badge variant="plan" mono={true}>
				<Text>{T_PLAN}</Text>
			</Badge>,
		);

		expect(getByText("Plan")).toBeTruthy();
	});
});
