import React from 'react';
import {LOGO} from '../logo/logoData';
import {COLORS} from '../theme';

/**
 * The official NEON mark, vector-traced from the source artwork
 * (IoU 0.994 against the original raster). Symbol and wordmark are exposed
 * separately so they can be laid out and revealed independently; both keep the
 * scale relationship of the original lockup.
 */
export const SYMBOL_BOX = LOGO.symbolBox;
export const WORDMARK_BOX = LOGO.wordmarkBox;

export const SymbolPaths: React.FC<{green?: string; bolt?: string}> = ({green = COLORS.green, bolt = COLORS.white}) => (
	<>
		<path d={LOGO.symbol} fill={green} fillRule="evenodd" />
		<path d={LOGO.bolt} fill={bolt} fillRule="evenodd" />
	</>
);

export const WordmarkPaths: React.FC<{fill?: string}> = ({fill = COLORS.white}) => <path d={LOGO.wordmark} fill={fill} fillRule="evenodd" />;
