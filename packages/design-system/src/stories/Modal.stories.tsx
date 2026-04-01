import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "../components/Button/Button.tsx";
import { Modal } from "../components/Modal/Modal.tsx";

const meta: Meta<typeof Modal> = {
	title: "Components/Modal",
	component: Modal,
};

export default meta;

type Story = StoryObj<typeof Modal>;

// biome-ignore lint/style/useComponentExportOnlyModules: story-local demo component
function ModalDemo() {
	const [open, setOpen] = useState(false);
	return (
		<div style={{ padding: 20 }}>
			{/* biome-ignore lint/nursery/noJsxPropsBind: story demo */}
			<Button onClick={() => setOpen(true)}>Open Modal</Button>
			{/* biome-ignore lint/nursery/noJsxPropsBind: story demo */}
			<Modal open={open} onClose={() => setOpen(false)}>
				<div style={{ padding: 24 }}>
					<h2 style={{ marginBottom: 12 }}>Modal Title</h2>
					<p>This is modal content. Press Escape or click outside to close.</p>
					<div style={{ marginTop: 16 }}>
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
		onClose: () => {},
		children: (
			<div style={{ padding: 24 }}>
				<h2 style={{ marginBottom: 12 }}>Static Modal</h2>
				<p>This modal is always open in this story.</p>
			</div>
		),
	},
};
