import { Text } from "@cookielab.io/klovi-design-system";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "../components/Button/Button";
import { Modal } from "../components/Modal/Modal";


const T_OPEN_MODAL = "Open Modal";
const T_MODAL_TITLE = "Modal Title";
const T_THIS_IS_MODAL_CONTENT_PRESS_ES = "This is modal content. Press Escape or click outside to close.";
const T_CLOSE = "Close";
const T_STATIC_MODAL = "Static Modal";
const T_THIS_MODAL_IS_ALWAYS_OPEN_IN_T = "This modal is always open in this story.";

const meta: Meta<typeof Modal> = {
	title: "Components/Modal",
	component: Modal,
};

export default meta;

type Story = StoryObj<typeof Modal>;

function ModalDemo(): React.ReactNode {
	const [open, setOpen] = useState(false);
	return (
		<div>
			<Button onClick={() => setOpen(true)}><Text>{T_OPEN_MODAL}</Text></Button>
			<Modal open={open} onClose={() => setOpen(false)}>
				<div>
					<h2><Text>{T_MODAL_TITLE}</Text></h2>
					<p><Text>{T_THIS_IS_MODAL_CONTENT_PRESS_ES}</Text></p>
					<div>
						<Button variant="primary" onClick={() => setOpen(false)}>
							<Text>{T_CLOSE}</Text>
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}

export const Interactive: Story = {
	render: () => <ModalDemo />,
};

export const Open: Story = {
	args: {
		open: true,
		onClose: () => undefined,
		children: (
			<div>
				<h2><Text>{T_STATIC_MODAL}</Text></h2>
				<p><Text>{T_THIS_MODAL_IS_ALWAYS_OPEN_IN_T}</Text></p>
			</div>
		),
	},
};
