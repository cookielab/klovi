import type React from "react";
import { useId } from "react";
import { Text } from "../index";
import { Input } from "./FormControls/Input";
import { Select } from "./FormControls/Select";
import { Toggle } from "./FormControls/Toggle";

const T_NAME = "Name";
const T_THEME = "Theme";

type FormControlsHarnessProps = {
	onInputChange: () => void;
	onSelectChange: () => void;
	onToggleChange: (checked: boolean) => void;
};

export function FormControlsHarness({
	onInputChange,
	onSelectChange,
	onToggleChange,
}: FormControlsHarnessProps): React.ReactNode {
	const nameId = useId();
	const themeId = useId();
	return (
		<div>
			<label htmlFor={nameId}>
				<Text>{T_NAME}</Text>
			</label>
			<Input id={nameId} value="Jane" onChange={onInputChange} />

			<label htmlFor={themeId}>
				<Text>{T_THEME}</Text>
			</label>
			<Select
				id={themeId}
				value="light"
				onChange={onSelectChange}
				options={[
					{ value: "light", label: "Light" },
					{ value: "dark", label: "Dark" },
				]}
			/>

			<Toggle checked={true} onChange={onToggleChange} label="Enabled" />
		</div>
	);
}
