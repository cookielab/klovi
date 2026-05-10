import { Text } from "@cookielab.io/klovi-design-system";
import type { Meta, StoryObj } from "@storybook/react";
import { Collapsible } from "../components/Collapsible/Collapsible";


const T_CONTENT_FOR_SECTION_1 = "Content for section 1";
const T_CONTENT_FOR_SECTION_2_STARTS_O = "Content for section 2 (starts open)";
const T_CONTENT_FOR_SECTION_3 = "Content for section 3";

const meta: Meta<typeof Collapsible> = {
	title: "Components/Collapsible",
	component: Collapsible,
};

export default meta;

type Story = StoryObj<typeof Collapsible>;

export const Closed: Story = {
	args: {
		title: "Click to expand",
		children: "This is the collapsible content. It can contain any React nodes.",
	},
};

export const Open: Story = {
	args: {
		title: "Already expanded",
		defaultOpen: true,
		children: "This section starts open by default.",
	},
};

export const Multiple: Story = {
	render: () => (
		<div>
			<Collapsible title="Section 1"><Text>{T_CONTENT_FOR_SECTION_1}</Text></Collapsible>
			<Collapsible title="Section 2" defaultOpen={true}>
				<Text>{T_CONTENT_FOR_SECTION_2_STARTS_O}</Text>
			</Collapsible>
			<Collapsible title="Section 3"><Text>{T_CONTENT_FOR_SECTION_3}</Text></Collapsible>
		</div>
	),
};
