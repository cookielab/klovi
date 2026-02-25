import type { Meta, StoryObj } from "@storybook/react";
import { Collapsible } from "../components/Collapsible/Collapsible.tsx";

const meta: Meta<typeof Collapsible> = {
  title: "Components/Collapsible",
  component: Collapsible,
};

export default meta;

type Story = StoryObj<typeof Collapsible>;

export const Closed: Story = {
  args: {
    title: "Click to expand",
    children: "This is the collapsible content. It can contain any React nodes.",
  },
};

export const Open: Story = {
  args: {
    title: "Already expanded",
    defaultOpen: true,
    children: "This section starts open by default.",
  },
};

export const Multiple: Story = {
  render: () => (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <Collapsible title="Section 1">Content for section 1</Collapsible>
      <Collapsible title="Section 2" defaultOpen>
        Content for section 2 (starts open)
      </Collapsible>
      <Collapsible title="Section 3">Content for section 3</Collapsible>
    </div>
  ),
};
