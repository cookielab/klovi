import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "../components/Badge/Badge.tsx";
import type { BadgeVariant } from "../types.ts";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
};

export default meta;

type Story = StoryObj<typeof Badge>;

const VARIANTS: BadgeVariant[] = [
  "user",
  "assistant",
  "agent",
  "sub-agent",
  "tool",
  "system",
  "error",
  "plan",
  "implementation",
  "default",
];

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 20 }}>
      {VARIANTS.map((v) => (
        <Badge key={v} variant={v}>
          {v}
        </Badge>
      ))}
    </div>
  ),
};

export const Mono: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 20 }}>
      {VARIANTS.map((v) => (
        <Badge key={v} variant={v} mono>
          {v}
        </Badge>
      ))}
    </div>
  ),
};
