import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

declare global {
  interface Window {
    require: (module: string) => any;
  }
}
