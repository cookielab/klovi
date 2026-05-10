import { Text } from "../index";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../components/Button/Button";


const T_DEFAULT = "Default";
const T_PRIMARY = "Primary";
const T_SMALL = "Small";
const T_PRIMARY_SM = "Primary SM";
const T_X = "X";

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
		<div>
			<Button><Text>{T_DEFAULT}</Text></Button>
			<Button variant="primary"><Text>{T_PRIMARY}</Text></Button>
			<Button size="sm"><Text>{T_SMALL}</Text></Button>
			<Button variant="primary" size="sm">
				<Text>{T_PRIMARY_SM}</Text>
			</Button>
			<Button icon={true}><Text>{T_X}</Text></Button>
		</div>
	),
};

export const meta: Meta<typeof Button> = {
	title: "Components/Button",
	component: Button,
};

