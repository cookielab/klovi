import type { Meta, StoryObj } from "@storybook/react";

const TOKEN_GROUPS = {
	Surfaces: [
		"color-surface",
		"color-surface-muted",
		"color-surface-sunken",
		"color-surface-raised",
		"color-surface-card",
		"color-surface-code",
	],
	Foreground: ["color-foreground", "color-foreground-muted", "color-foreground-subtle", "color-foreground-inverse"],
	Roles: ["color-role-user", "color-role-assistant", "color-role-tool", "color-role-subagent", "color-role-agent"],
	Accent: ["color-accent", "color-accent-hover", "color-accent-subtle"],
	Borders: ["color-border", "color-border-muted"],
	Status: ["color-error", "color-success"],
};

// biome-ignore lint/style/useComponentExportOnlyModules: story-local helper component
function Swatch({ name }: { name: string }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
			<div
				style={{
					width: 48,
					height: 32,
					background: `var(--${name})`,
					border: "1px solid var(--color-border)",
				}}
			/>
			<code style={{ fontSize: "0.85rem" }}>--{name}</code>
		</div>
	);
}

// biome-ignore lint/style/useComponentExportOnlyModules: story-local demo component
function TokenPalette() {
	return (
		<div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 32 }}>
			{Object.entries(TOKEN_GROUPS).map(([group, tokens]) => (
				<div key={group}>
					<h3 style={{ marginBottom: 12, fontSize: "1rem", fontWeight: 600 }}>{group}</h3>
					{tokens.map((t) => (
						<Swatch key={t} name={t} />
					))}
				</div>
			))}
		</div>
	);
}

const meta: Meta = {
	title: "Foundations/Tokens",
	component: TokenPalette,
};

export default meta;

type Story = StoryObj;

export const ColorPalette: Story = {};
