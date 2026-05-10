import type { ReactNode } from "react";

type TextProps = {
	children: ReactNode;
};

export function Text({ children }: TextProps): ReactNode {
	return children;
}
