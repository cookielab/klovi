import { Text } from "@cookielab.io/klovi-design-system";
import type { Meta, StoryObj } from "@storybook/react";


const T_TEXT = "--";

const TOKEN_GROUPS = {
	["Surfaces"]: [
		"color-surface",
		"color-surface-muted",
		"color-surface-sunken",
		"color-surface-raised",
		"color-surface-card",
		"color-surface-code",
	],
	["Foreground"]: ["color-foreground", "color-foreground-muted", "color-foreground-subtle", "color-foreground-inverse"],
	["Roles"]: ["color-role-user", "color-role-assistant", "color-role-tool", "color-role-subagent", "color-role-agent"],
	["Accent"]: ["color-accent", "color-accent-hover", "color-accent-subtle"],
	["Borders"]: ["color-border", "color-border-muted"],
	["Status"]: ["color-error", "color-success"],
};

function Swatch({ name }: { name: string }): React.ReactNode {
	return (
		<div>
			<div />
			<code><Text>{T_TEXT}</Text>{name}</code>
		</div>
	);
}

function TokenPalette(): React.ReactNode {
	return (
		<div>
			{Object.entries(TOKEN_GROUPS).map(([group, tokens]) => (
				<div key={group}>
					<h3>{group}</h3>
					{tokens.map((t) => (
						<Swatch key={t} name={t} />
					))}
				</div>
			))}
		</div>
	);
}

type Story = StoryObj;

export const ColorPalette: Story = {};

export const meta: Meta = {
	title: "Foundations/Tokens",
	component: TokenPalette,
};

