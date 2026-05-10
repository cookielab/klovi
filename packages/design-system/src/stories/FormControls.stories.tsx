import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";
import { Input } from "../components/FormControls/Input";
import { SegmentedControl } from "../components/FormControls/SegmentedControl";
import { Select } from "../components/FormControls/Select";
import { Toggle } from "../components/FormControls/Toggle";

export const InputStory: Story = () => (
	<div>
		<Input placeholder="Type here..." />
	</div>
);
InputStory.storyName = "Input";

export const SelectStory: Story = () => (
	<div>
		<Select
			options={[
				{ value: "opt1", label: "Option 1" },
				{ value: "opt2", label: "Option 2" },
				{ value: "opt3", label: "Option 3" },
			]}
		/>
	</div>
);
SelectStory.storyName = "Select";

function ToggleDemo(): React.ReactNode {
	const [checked, setChecked] = useState(false);
	return (
		<div>
			<Toggle checked={checked} onChange={setChecked} label="Enable feature" />
		</div>
	);
}

export const ToggleStory: Story = () => <ToggleDemo />;
ToggleStory.storyName = "Toggle";

function SegmentedDemo(): React.ReactNode {
	const [value, setValue] = useState<"system" | "light" | "dark">("system");
	return (
		<div>
			<SegmentedControl
				value={value}
				onChange={setValue}
				options={[
					{ value: "system" as const, label: "System" },
					{ value: "light" as const, label: "Light" },
					{ value: "dark" as const, label: "Dark" },
				]}
			/>
		</div>
	);
}

export const SegmentedStory: Story = () => <SegmentedDemo />;
SegmentedStory.storyName = "SegmentedControl";

export default { title: "Components/FormControls" } satisfies StoryDefault;
