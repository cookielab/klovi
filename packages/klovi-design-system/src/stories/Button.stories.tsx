import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../components/Button/Button.tsx";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Button",
  },
};

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary Button",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "Small Button",
  },
};

export const PrimarySmall: Story = {
  args: {
    variant: "primary",
    size: "sm",
    children: "Primary SM",
  },
};

export const Icon: Story = {
  args: {
    icon: true,
    children: "X",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 20 }}>
      <Button>Default</Button>
      <Button variant="primary">Primary</Button>
      <Button size="sm">Small</Button>
      <Button variant="primary" size="sm">
        Primary SM
      </Button>
      <Button icon>X</Button>
    </div>
  ),
};
