import type { Story, StoryDefault } from "@ladle/react";
import { Badge } from "../components/Badge/Badge";
import type { BadgeVariant } from "../types";

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

export const AllVariants: Story = () => (
	<div>
		{VARIANTS.map((v) => (
			<Badge key={v} variant={v}>
				{v}
			</Badge>
		))}
	</div>
);

export const Mono: Story = () => (
	<div>
		{VARIANTS.map((v) => (
			<Badge key={v} variant={v} mono={true}>
				{v}
			</Badge>
		))}
	</div>
);

export default { title: "Components/Badge" } satisfies StoryDefault;
