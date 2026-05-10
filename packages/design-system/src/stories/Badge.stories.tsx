import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "../components/Badge/Badge";
import type { BadgeVariant } from "../types";

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
		<div>
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
		<div>
			{VARIANTS.map((v) => (
				<Badge key={v} variant={v} mono={true}>
					{v}
				</Badge>
			))}
		</div>
	),
};
