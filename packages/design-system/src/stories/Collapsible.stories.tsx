import type { Story, StoryDefault } from "@ladle/react";
import type { ComponentProps } from "react";
import { Collapsible } from "../components/Collapsible/Collapsible";
import { Text } from "../index";

type CollapsibleProps = ComponentProps<typeof Collapsible>;

const T_CONTENT_FOR_SECTION_1 = "Content for section 1";
const T_CONTENT_FOR_SECTION_2_STARTS_O = "Content for section 2 (starts open)";
const T_CONTENT_FOR_SECTION_3 = "Content for section 3";

const argTypes = {
	title: {
		control: { type: "text" as const },
	},
	defaultOpen: {
		control: { type: "boolean" as const },
	},
	children: {
		control: { type: "text" as const },
	},
};

export const Closed: Story<CollapsibleProps> = (props) => <Collapsible {...props} />;
Closed.args = {
	title: "Click to expand",
	children: "This is the collapsible content. It can contain any React nodes.",
};
Closed.argTypes = argTypes;

export const Open: Story<CollapsibleProps> = (props) => <Collapsible {...props} />;
Open.args = {
	title: "Already expanded",
	defaultOpen: true,
	children: "This section starts open by default.",
};
Open.argTypes = argTypes;

export const Multiple: Story = () => (
	<div>
		<Collapsible title="Section 1">
			<Text>{T_CONTENT_FOR_SECTION_1}</Text>
		</Collapsible>
		<Collapsible title="Section 2" defaultOpen={true}>
			<Text>{T_CONTENT_FOR_SECTION_2_STARTS_O}</Text>
		</Collapsible>
		<Collapsible title="Section 3">
			<Text>{T_CONTENT_FOR_SECTION_3}</Text>
		</Collapsible>
	</div>
);

export default { title: "Components/Collapsible" } satisfies StoryDefault<CollapsibleProps>;
