import type { Meta, StoryObj } from "@storybook/react";
import { TurnBox } from "../components/TurnBox/TurnBox.tsx";
import type { TurnRole } from "../types.ts";

const meta: Meta<typeof TurnBox> = {
  title: "Components/TurnBox",
  component: TurnBox,
};

export default meta;

type Story = StoryObj<typeof TurnBox>;

const ROLES: TurnRole[] = ["user", "assistant", "agent", "sub-agent", "system", "error"];

export const AllRoles: Story = {
  render: () => (
    <div style={{ padding: 20, maxWidth: 900 }}>
      {ROLES.map((role) => (
        <TurnBox key={role} role={role} timestamp={<span>2 min ago</span>}>
          <p>This is a {role} message. The left border and badge color change based on the role.</p>
        </TurnBox>
      ))}
    </div>
  ),
};

export const WithModel: Story = {
  render: () => (
    <div style={{ padding: 20, maxWidth: 900 }}>
      {/* biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role */}
      <TurnBox role="assistant" model="claude-4-opus" timestamp={<span>just now</span>}>
        <p>This assistant message includes a model badge.</p>
      </TurnBox>
    </div>
  ),
};

export const CustomBadge: Story = {
  render: () => (
    <div style={{ padding: 20, maxWidth: 900 }}>
      {/* biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role */}
      <TurnBox role="agent" badge="Root Agent">
        <p>Custom badge text overrides the default role label.</p>
      </TurnBox>
    </div>
  ),
};
