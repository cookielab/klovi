import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "../components/Button/Button";
import { Modal } from "../components/Modal/Modal";

const meta: Meta<typeof Modal> = {
	title: "Components/Modal",
	component: Modal,
};

export default meta;

type Story = StoryObj<typeof Modal>;

function ModalDemo() {
	const [open, setOpen] = useState(false);
	return (
		<div>
			{/* biome-ignore lint/nursery/noJsxPropsBind: story demo */}
			<Button onClick={() => setOpen(true)}>Open Modal</Button>
			{/* biome-ignore lint/nursery/noJsxPropsBind: story demo */}
			<Modal open={open} onClose={() => setOpen(false)}>
				<div>
					<h2>Modal Title</h2>
					<p>This is modal content. Press Escape or click outside to close.</p>
					<div>
						{/* biome-ignore lint/nursery/noJsxPropsBind: story demo */}
						<Button variant="primary" onClick={() => setOpen(false)}>
							Close
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
				<h2>Static Modal</h2>
				<p>This modal is always open in this story.</p>
			</div>
		),
	},
};
