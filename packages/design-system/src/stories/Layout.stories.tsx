import { Text } from "../index";
import type { Meta, StoryObj } from "@storybook/react";
import { AppLayout } from "../components/Layout/AppLayout";
import { ContentHeader } from "../components/Layout/ContentHeader";
import { Sidebar } from "../components/Layout/Sidebar";


const T_APP_NAME = "App Name";
const T_FOOTER_CONTENT = "Footer content";
const T_SIDEBAR_CONTENT_GOES_HERE = "Sidebar content goes here";
const T_PAGE_TITLE = "Page Title";
const T_ACTION = "Action";
const T_MAIN_CONTENT_AREA = "Main content area";
const T_APP = "App";
const T_HIDDEN_SIDEBAR = "Hidden sidebar";
const T_FULL_WIDTH = "Full Width";
const T_CONTENT_TAKES_FULL_WIDTH_WHEN_ = "Content takes full width when sidebar is hidden";

type Story = StoryObj<typeof AppLayout>;

export const Default: Story = {
	render: () => (
		<AppLayout
			sidebar={
				<Sidebar header={<h1><Text>{T_APP_NAME}</Text></h1>} footer={<span><Text>{T_FOOTER_CONTENT}</Text></span>}>
					<div><Text>{T_SIDEBAR_CONTENT_GOES_HERE}</Text></div>
				</Sidebar>
			}
		>
			<ContentHeader left={<span><Text>{T_PAGE_TITLE}</Text></span>} right={<button type="button"><Text>{T_ACTION}</Text></button>} />
			<div><Text>{T_MAIN_CONTENT_AREA}</Text></div>
		</AppLayout>
	),
};

export const HiddenSidebar: Story = {
	render: () => (
		<AppLayout
			hideSidebar={true}
			sidebar={
				<Sidebar header={<h1><Text>{T_APP}</Text></h1>}>
					<div><Text>{T_HIDDEN_SIDEBAR}</Text></div>
				</Sidebar>
			}
		>
			<ContentHeader left={<span><Text>{T_FULL_WIDTH}</Text></span>} />
			<div><Text>{T_CONTENT_TAKES_FULL_WIDTH_WHEN_}</Text></div>
		</AppLayout>
	),
};

export const meta: Meta<typeof AppLayout> = {
	title: "Components/Layout",
	component: AppLayout,
};

