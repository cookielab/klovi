import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Input } from "../components/FormControls/Input.tsx";
import { SegmentedControl } from "../components/FormControls/SegmentedControl.tsx";
import { Select } from "../components/FormControls/Select.tsx";
import { Toggle } from "../components/FormControls/Toggle.tsx";

const meta: Meta = {
  title: "Components/FormControls",
};

export default meta;

type Story = StoryObj;

export const InputStory: Story = {
  name: "Input",
  render: () => (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <Input placeholder="Type here..." />
    </div>
  ),
};

export const SelectStory: Story = {
  name: "Select",
  render: () => (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <Select
        options={[
          { value: "opt1", label: "Option 1" },
          { value: "opt2", label: "Option 2" },
          { value: "opt3", label: "Option 3" },
        ]}
      />
    </div>
  ),
};

function ToggleDemo() {
  const [checked, setChecked] = useState(false);
  return (
    <div style={{ padding: 20 }}>
      <Toggle checked={checked} onChange={setChecked} label="Enable feature" />
    </div>
  );
}

export const ToggleStory: Story = {
  name: "Toggle",
  render: () => <ToggleDemo />,
};

function SegmentedDemo() {
  const [value, setValue] = useState<"system" | "light" | "dark">("system");
  return (
    <div style={{ padding: 20 }}>
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

export const SegmentedStory: Story = {
  name: "SegmentedControl",
  render: () => <SegmentedDemo />,
};
