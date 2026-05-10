import type { Story, StoryDefault } from "@ladle/react";
import type { ComponentProps } from "react";
import { Button } from "../components/Button/Button";
import { Text } from "../index";

type ButtonProps = ComponentProps<typeof Button>;

const T_DEFAULT = "Default";
const T_PRIMARY = "Primary";
const T_SMALL = "Small";
const T_PRIMARY_SM = "Primary SM";
const T_X = "X";

const argTypes = {
	variant: {
		options: ["default", "primary"],
		control: { type: "select" as const },
	},
	size: {
		options: ["md", "sm"],
		control: { type: "select" as const },
	},
	icon: {
		control: { type: "boolean" as const },
	},
	children: {
		control: { type: "text" as const },
	},
};

export const Default: Story<ButtonProps> = (props) => <Button {...props} />;
Default.args = { children: "Button" };
Default.argTypes = argTypes;

export const Primary: Story<ButtonProps> = (props) => <Button {...props} />;
Primary.args = { variant: "primary", children: "Primary Button" };
Primary.argTypes = argTypes;

export const Small: Story<ButtonProps> = (props) => <Button {...props} />;
Small.args = { size: "sm", children: "Small Button" };
Small.argTypes = argTypes;

export const PrimarySmall: Story<ButtonProps> = (props) => <Button {...props} />;
PrimarySmall.args = { variant: "primary", size: "sm", children: "Primary SM" };
PrimarySmall.argTypes = argTypes;

export const Icon: Story<ButtonProps> = (props) => <Button {...props} />;
Icon.args = { icon: true, children: "X" };
Icon.argTypes = argTypes;

export const AllVariants: Story = () => (
	<div>
		<Button>
			<Text>{T_DEFAULT}</Text>
		</Button>
		<Button variant="primary">
			<Text>{T_PRIMARY}</Text>
		</Button>
		<Button size="sm">
			<Text>{T_SMALL}</Text>
		</Button>
		<Button variant="primary" size="sm">
			<Text>{T_PRIMARY_SM}</Text>
		</Button>
		<Button icon={true}>
			<Text>{T_X}</Text>
		</Button>
	</div>
);

export default { title: "Components/Button" } satisfies StoryDefault<ButtonProps>;
