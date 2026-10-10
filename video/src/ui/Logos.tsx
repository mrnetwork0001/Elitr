import React from "react";
import { Img, staticFile } from "remotion";

// BNB Chain logos are the official files from https://www.bnbchain.org/en/brand-guidelines, used as
// supplied (never redrawn or recoloured) and only with "Built on" wording, per those guidelines.
// Full logo 319x56; symbol 96x96.
export const BnbChainLogo: React.FC<{ height: number; variant?: "white" | "black" | "yellow"; style?: React.CSSProperties }> = ({ height, variant = "white", style }) => (
  <Img src={staticFile(`brand/bnbchain-logo-${variant}.svg`)} style={{ height, width: (height * 319) / 56, ...style }} />
);
export const BnbChainSymbol: React.FC<{ size: number; variant?: "white" | "yellow"; style?: React.CSSProperties }> = ({ size, variant = "yellow", style }) => (
  <Img src={staticFile(`brand/bnbchain-symbol-${variant}.svg`)} style={{ width: size, height: size, ...style }} />
);
