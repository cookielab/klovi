import type { Meta, StoryObj } from "@storybook/react";
import { AppLayout } from "../components/Layout/AppLayout";
import { ContentHeader } from "../components/Layout/ContentHeader";
import { Sidebar } from "../components/Layout/Sidebar";

const meta: Meta<typeof AppLayout> = {
	title: "Components/Layout",
	component: AppLayout,
};

export default meta;

type Story = StoryObj<typeof AppLayout>;

export const Default: Story = {
	render: () => (
		<AppLayout
			sidebar={
				<Sidebar header={<h1>App Name</h1>} footer={<span>Footer content</span>}>
					<div>Sidebar content goes here</div>
				</Sidebar>
			}
		>
			<ContentHeader left={<span>Page Title</span>} right={<button type="button">Action</button>} />
			<div>Main content area</div>
		</AppLayout>
	),
};

export const HiddenSidebar: Story = {
	render: () => (
		<AppLayout
			hideSidebar={true}
			sidebar={
				<Sidebar header={<h1>App</h1>}>
					<div>Hidden sidebar</div>
				</Sidebar>
			}
		>
			<ContentHeader left={<span>Full Width</span>} />
			<div>Content takes full width when sidebar is hidden</div>
		</AppLayout>
	),
};
