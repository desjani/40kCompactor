declare module 'ansi_up' {
  declare class AnsiUp {
    ansi_to_html(input: string): string
  }

  declare module 'ansi_up' {
    export default AnsiUp
    export { AnsiUp }
  }
}
