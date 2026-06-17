declare module '../../../modules/parsers.js' {
  export function parseWtcCompact(text: string): any
  export function parseWtc(text: string): any
  export function parseGwApp(text: string): any
  export function parseNrGw(text: string): any
  export function parseNrNr(text: string): any
  export function parseLf(text: string): any
  export function detectFormat(lines: string[]): string
}

declare module '../../../modules/renderers.js' {
  export function buildFactionColorMap(skippableMap?: any): any
  export const HIDE_ALL: string
  export function generateOutput(
    data: any,
    useAbbreviations: boolean,
    wargearAbbrMap: any,
    hideSubunits: boolean,
    skippableWargearMap: any,
    applyHeaderColor?: boolean,
    combineIdenticalUnits?: boolean,
  ): { html: string; plainText: string }
  export function generateDiscordText(
    data: any,
    plain: boolean,
    useAbbreviations: boolean,
    wargearAbbrMap: any,
    hideSubunits: boolean,
    skippableWargearMap: any,
    combineIdenticalUnits?: boolean,
  ): string
  export function resolveFactionColors(data: any, skippableWargearMap: any): any
}

declare module '../../../modules/abbreviations.js' {
  export function makeAbbrevForName(name: string): string | null
  export function buildAbbreviationIndex(parsedData: any): any
}
