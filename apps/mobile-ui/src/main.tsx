import { render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import * as AnsiUpNS from 'ansi_up'
import './style.css'

// Import shared modules from repo root
// @ts-ignore - ambient types provided separately for JS modules
import * as parsers from '../../../modules/parsers.js'
// @ts-ignore - ambient types provided separately for JS modules
import { generateOutput, generateDiscordText } from '../../../modules/renderers.js'
// @ts-ignore - ambient types provided separately for JS modules
import { buildAbbreviationIndex } from '../../../modules/abbreviations.js'
import skippable from '../../../skippable_wargear.json'

function useLocalStorage<T>(key: string, initial: T): [T, (v: T)=>void] {
  const [val, setVal] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }, [key, val])
  return [val, setVal]
}

function TabButton({ id, active, label, onClick }: { id: string, active: boolean, label: string, onClick: ()=>void }) {
  return <button class={`tab ${active ? 'active': ''}`} onClick={onClick}>{label}</button>
}

function App() {
  const [tab, setTab] = useLocalStorage('tab','input')
  const [text, setText] = useLocalStorage('text','')
  const [hide, setHide] = useLocalStorage('hide', false)
  const [combine, setCombine] = useLocalStorage('combine', false)
  const [multiline, setMultiline] = useLocalStorage('multiline', false)
  const [colorMode, setColorMode] = useLocalStorage<'none'|'custom'|'faction'>('colorMode', 'faction')
  const [colors, setColors] = useLocalStorage('colors', { unit:'#ffffff', subunit:'#808080', wargear:'#ffffff', points:'#ffff00', header:'#ffff00' })
  const [format, setFormat] = useLocalStorage<'discordCompact'|'discordExtended'|'plainText'|'plainTextExtended'>('format','discordCompact')

  const parsed = useMemo(() => {
    if (!text.trim()) return null
    const lines = text.split(/\r?\n/)
    const fmt = parsers.detectFormat(lines)
    const parseFn = ({
      'GW_APP': parsers.parseGwApp,
      'WTC_COMPACT': parsers.parseWtcCompact,
      'WTC': parsers.parseWtc,
      'NR_GW': parsers.parseNrGw,
      'NRNR': parsers.parseNrNr,
      'LF': parsers.parseLf
    } as any)[fmt]
    if (!parseFn) return null
    try { return parseFn(lines) } catch { return null }
  }, [text])

  const abbr = useMemo(() => parsed ? buildAbbreviationIndex(parsed) : null, [parsed])

  const fullText = useMemo(() => {
    if (!parsed || !abbr) return ''
    return generateOutput(parsed, false, abbr, false, skippable as any, false, false).plainText
  }, [parsed, abbr])

  const compactText = useMemo(() => {
    if (!parsed || !abbr) return ''
    return generateOutput(parsed, true, abbr, hide, skippable as any, true, combine).plainText
  }, [parsed, abbr, hide, combine])

  const [previewText, setPreviewText] = useState('')
  // Support different module export shapes across bundlers/browsers
  const au = useMemo(() => {
    const Ctor: any = (AnsiUpNS as any).default ?? (AnsiUpNS as any).AnsiUp ?? AnsiUpNS
    try {
      return new Ctor()
    } catch {
      // Fallback: if the module itself is a function/class
      return new (AnsiUpNS as any)()
    }
  }, [])
  useEffect(() => {
    if (!parsed || !abbr) { setPreviewText(''); return }
    let t = ''
  const opts = { colorMode, colors } as any
  switch (format) {
      case 'discordCompact':
    t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts); break
      case 'discordExtended':
    t = generateDiscordText(parsed, false, false, abbr, hide, skippable as any, combine, opts); break
      case 'plainText':
    t = generateDiscordText(parsed, true, true, abbr, hide, skippable as any, combine, opts); break
      case 'plainTextExtended':
    t = generateDiscordText(parsed, true, false, abbr, hide, skippable as any, combine, opts); break
      default:
    t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts)
    }
    setPreviewText(t)
  }, [parsed, abbr, hide, combine, colorMode, colors, multiline, format])
  const previewHtml = useMemo(() => au.ansi_to_html(previewText), [previewText, au])

  function copy(s: string) {
    if (!s || !parsed || !abbr) { navigator.clipboard?.writeText(s || ''); return }
    const opts: any = { colorMode, colors, forcePalette: true }
    let t = ''
    switch (format) {
      case 'discordCompact':
        t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts); break
      case 'discordExtended':
        t = generateDiscordText(parsed, false, false, abbr, hide, skippable as any, combine, opts); break
      case 'plainText':
        t = generateDiscordText(parsed, true, true, abbr, hide, skippable as any, combine, opts); break
      case 'plainTextExtended':
        t = generateDiscordText(parsed, true, false, abbr, hide, skippable as any, combine, opts); break
      default:
        t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts)
    }
    navigator.clipboard?.writeText(t)
  }

  return (
  <div class="container">
      <header>
        <div class="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>40k Compactor</strong>
          <span class="pill">Mobile</span>
        </div>
      </header>

      <div class="screen">
        {tab === 'input' && (
          <div class="section">
            <textarea placeholder="Paste your list here" value={text} onInput={(e:any)=>setText(e.currentTarget.value)} />
            <div class="row" style={{ marginTop: '6px', justifyContent: 'space-between' }}>
              <span class="pill">{text.length} chars</span>
              <button class="btn" onClick={()=>setText('')}>Clear</button>
            </div>
          </div>
        )}

        {tab === 'compact' && (
          <div class="section">
            <div class="row" style={{ marginBottom: '6px', justifyContent:'space-between' }}>
              <label>
                Output:
                <select value={format} onChange={e=>setFormat((e.target as HTMLSelectElement).value as any)} style={{ marginLeft: '6px' }}>
                  <option value="discordCompact">Discord (Compact)</option>
                  <option value="discordExtended">Discord (Extended)</option>
                  <option value="plainText">Plain Text</option>
                  <option value="plainTextExtended">Plain Text (extended)</option>
                </select>
              </label>
            </div>

            <div class="row" style={{ marginBottom: '6px', justifyContent:'space-between' }}>
              <label><input type="checkbox" checked={hide} onChange={e=>setHide((e.target as HTMLInputElement).checked)} /> Hide Subunits</label>
              <label><input type="checkbox" checked={combine} onChange={e=>setCombine((e.target as HTMLInputElement).checked)} /> Combine like units</label>
              <label><input id="multilineHeaderCheckbox" type="checkbox" checked={multiline} onChange={e=>setMultiline((e.target as HTMLInputElement).checked)} /> Multiline Header</label>
            </div>

            <div class="row" style={{ gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
              <label>
                <input type="radio" name="colorMode" value="none" checked={colorMode==='none'} onChange={()=>setColorMode('none')} />
                <span style={{ marginLeft: '6px' }}>No color</span>
              </label>
              <label>
                <input type="radio" name="colorMode" value="custom" checked={colorMode==='custom'} onChange={()=>setColorMode('custom')} />
                <span style={{ marginLeft: '6px' }}>Custom</span>
              </label>
              <label>
                <input type="radio" name="colorMode" value="faction" checked={colorMode==='faction'} onChange={()=>setColorMode('faction')} />
                <span style={{ marginLeft: '6px' }}>Faction Color</span>
              </label>
            </div>
            {colorMode==='custom' && (
              <div class="grid2 section">
                {(['unit','subunit','wargear','points','header'] as const).map(k => (
                  <label>
                    {k} color
                    <input id={`${k}Color`} type="color" value={(colors as any)[k]} onChange={e=>setColors({...colors, [k]:(e.target as HTMLInputElement).value})} style={{ marginLeft: '6px' }} />
                  </label>
                ))}
              </div>
            )}
            <div class="outbox" id="markdownPreviewOutput" dangerouslySetInnerHTML={{ __html: previewHtml }}></div>
            <div class="row" style={{ marginTop: '6px', justifyContent:'flex-end' }}>
              <button class="btn" onClick={()=>copy(previewText)}>Copy</button>
            </div>
          </div>
        )}

        {tab === 'full' && (
          <div class="section">
            <div class="outbox">{fullText}</div>
            <div class="row" style={{ marginTop: '6px', justifyContent:'flex-end' }}>
              <button class="btn" onClick={()=>copy(fullText)}>Copy</button>
            </div>
          </div>
        )}

        
      </div>

      <nav class="tabs">
        <TabButton id="input" active={tab==='input'} label="Input" onClick={()=>setTab('input')} />
        <TabButton id="compact" active={tab==='compact'} label="Compact" onClick={()=>setTab('compact')} />
        <TabButton id="full" active={tab==='full'} label="Full" onClick={()=>setTab('full')} />
      </nav>
    </div>
  )
}

render(<App />, document.getElementById('app')!)
