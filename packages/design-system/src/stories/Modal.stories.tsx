import type { Story, StoryDefault } from "@ladle/react";
import type { ComponentProps } from "react";
import { useCallback, useState } from "react";
import { Button } from "../components/Button/Button";
import { Modal } from "../components/Modal/Modal";
import { Text } from "../index";

type ModalProps = ComponentProps<typeof Modal>;

const noop = (): undefined => undefined;
const T_OPEN_MODAL = "Open Modal";
const T_MODAL_TITLE = "Modal Title";
const T_THIS_IS_MODAL_CONTENT_PRESS_ES = "This is modal content. Press Escape or click outside to close.";
const T_CLOSE = "Close";
const T_STATIC_MODAL = "Static Modal";
const T_THIS_MODAL_IS_ALWAYS_OPEN_IN_T = "This modal is always open in this story.";

function ModalDemo(): React.ReactNode {
	const [open, setOpen] = useState(false);
	const handleOpen = useCallback((): void => {
		setOpen(true);
	}, []);
	const handleClose = useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<div>
			<Button onClick={handleOpen}>
				<Text>{T_OPEN_MODAL}</Text>
			</Button>
			<Modal open={open} onClose={handleClose}>
				<div>
					<h2>
						<Text>{T_MODAL_TITLE}</Text>
					</h2>
					<p>
						<Text>{T_THIS_IS_MODAL_CONTENT_PRESS_ES}</Text>
					</p>
					<div>
						<Button variant="primary" onClick={handleClose}>
							<Text>{T_CLOSE}</Text>
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}

export const Interactive: Story = () => <ModalDemo />;

export const Open: Story<ModalProps> = (props) => <Modal {...props} />;
Open.args = {
	open: true,
	onClose: noop,
	children: (
		<div>
			<h2>
				<Text>{T_STATIC_MODAL}</Text>
			</h2>
			<p>
				<Text>{T_THIS_MODAL_IS_ALWAYS_OPEN_IN_T}</Text>
			</p>
		</div>
	),
};

export default { title: "Components/Modal" } satisfies StoryDefault<ModalProps>;
