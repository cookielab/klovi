import { Text } from "@cookielab.io/klovi-design-system";
import type { Meta, StoryObj } from "@storybook/react";
import { TurnBox } from "../components/TurnBox/TurnBox";
import type { TurnRole } from "../types";


const T_2_MIN_AGO = "2 min ago";
const T_THIS_IS_A = "This is a";
const T_SP_1 = " ";
const T_MESSAGE_THE_LEFT_BORDER_AND_BA = "message. The left border and badge color change based on the role.";
const T_JUST_NOW = "just now";
const T_THIS_ASSISTANT_MESSAGE_INCLUDE = "This assistant message includes a model badge.";
const T_CUSTOM_BADGE_TEXT_OVERRIDES_TH = "Custom badge text overrides the default role label.";

type Story = StoryObj<typeof TurnBox>;

const ROLES: TurnRole[] = ["user", "assistant", "agent", "sub-agent", "system", "error"];

export const AllRoles: Story = {
	render: () => (
		<div>
			{ROLES.map((role) => (
				<TurnBox key={role} role={role} timestamp={<span><Text>{T_2_MIN_AGO}</Text></span>}>
					<p><Text>{T_THIS_IS_A}</Text><Text>{T_SP_1}</Text>{role}<Text>{T_SP_1}</Text><Text>{T_MESSAGE_THE_LEFT_BORDER_AND_BA}</Text></p>
				</TurnBox>
			))}
		</div>
	),
};

export const WithModel: Story = {
	render: () => (
		<div>
			<TurnBox role="assistant" model="claude-4-opus" timestamp={<span><Text>{T_JUST_NOW}</Text></span>}>
				<p><Text>{T_THIS_ASSISTANT_MESSAGE_INCLUDE}</Text></p>
			</TurnBox>
		</div>
	),
};

export const CustomBadge: Story = {
	render: () => (
		<div>
			<TurnBox role="agent" badge="Root Agent">
				<p><Text>{T_CUSTOM_BADGE_TEXT_OVERRIDES_TH}</Text></p>
			</TurnBox>
		</div>
	),
};

export const meta: Meta<typeof TurnBox> = {
	title: "Components/TurnBox",
	component: TurnBox,
};

