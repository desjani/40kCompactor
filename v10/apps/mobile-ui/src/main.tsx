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
  const [noBullets, setNoBullets] = useLocalStorage('noBullets', false)
  const [hidePoints, setHidePoints] = useLocalStorage('hidePoints', false)
  const [customAbbrs, setCustomAbbrs] = useLocalStorage<Record<string,string>>('customAbbrs', {})
  const [colorMode, setColorMode] = useLocalStorage<'none'|'custom'|'faction'>('colorMode', 'faction')
  const [colors, setColors] = useLocalStorage('colors', { unit:'#ffffff', subunit:'#808080', wargear:'#ffffff', points:'#ffff00', header:'#ffff00' })
  const [format, setFormat] = useLocalStorage<'discordCompact'|'discordExtended'|'plainText'|'plainTextExtended'>('format','discordCompact')

  // Temporary state for adding new abbreviations
  const [newAbbrName, setNewAbbrName] = useState('')
  const [newAbbrCode, setNewAbbrCode] = useState('')

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

  const abbr = useMemo(() => parsed ? buildAbbreviationIndex(parsed, customAbbrs) : null, [parsed, customAbbrs])

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
  const opts = { colorMode, colors, multilineHeader: multiline } as any
  switch (format) {
      case 'discordCompact':
    t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'discordExtended':
    t = generateDiscordText(parsed, false, false, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainText':
    t = generateDiscordText(parsed, true, true, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainTextExtended':
    t = generateDiscordText(parsed, true, false, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      default:
    t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints)
    }
    setPreviewText(t)
  }, [parsed, abbr, hide, combine, colorMode, colors, multiline, format, noBullets, hidePoints])
  const previewHtml = useMemo(() => au.ansi_to_html(previewText), [previewText, au])

  function copy(s: string) {
    if (!s || !parsed || !abbr) { navigator.clipboard?.writeText(s || ''); return }
    const opts: any = { colorMode, colors, forcePalette: true, multilineHeader: multiline }
    let t = ''
    switch (format) {
      case 'discordCompact':
        t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'discordExtended':
        t = generateDiscordText(parsed, false, false, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainText':
        t = generateDiscordText(parsed, true, true, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainTextExtended':
        t = generateDiscordText(parsed, true, false, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints); break
      default:
        t = generateDiscordText(parsed, false, true, abbr, hide, skippable as any, combine, opts, noBullets, hidePoints)
    }
    navigator.clipboard?.writeText(t)
  }

  function addCustomAbbr() {
    if (!newAbbrName.trim() || !newAbbrCode.trim()) return
    setCustomAbbrs({ ...customAbbrs, [newAbbrName.trim()]: newAbbrCode.trim() })
    setNewAbbrName('')
    setNewAbbrCode('')
  }

  function removeCustomAbbr(name: string) {
    const next = { ...customAbbrs }
    delete next[name]
    setCustomAbbrs(next)
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

            <div class="row" style={{ marginBottom: '6px', justifyContent:'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <label><input id="multilineHeaderCheckbox" type="checkbox" checked={multiline} onChange={e=>setMultiline((e.target as HTMLInputElement).checked)} /> Multiline Header</label>
              <label><input type="checkbox" checked={combine} onChange={e=>setCombine((e.target as HTMLInputElement).checked)} /> Combine like units</label>
              <label><input type="checkbox" checked={hide} onChange={e=>setHide((e.target as HTMLInputElement).checked)} /> Hide Subunits</label>
              <label><input type="checkbox" checked={noBullets} onChange={e=>setNoBullets((e.target as HTMLInputElement).checked)} /> Hide Bullets</label>
              <label><input type="checkbox" checked={hidePoints} onChange={e=>setHidePoints((e.target as HTMLInputElement).checked)} /> Hide Points</label>
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

            <div class="section" style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
              <details>
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem', fontWeight: 'bold' }}>Custom Abbreviations</summary>
                <div class="row" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="text" placeholder="Name (e.g. Plasma Pistol)" value={newAbbrName} onInput={(e:any)=>setNewAbbrName(e.currentTarget.value)} style={{ flex: 2, minHeight: '30px', padding: '4px' }} />
                  <input type="text" placeholder="Abbr (e.g. PP)" value={newAbbrCode} onInput={(e:any)=>setNewAbbrCode(e.currentTarget.value)} style={{ flex: 1, minHeight: '30px', padding: '4px' }} />
                  <button class="btn" onClick={addCustomAbbr} style={{ padding: '4px 8px' }}>Add</button>
                </div>
                <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.85rem', border: '1px solid #333', padding: '4px' }}>
                  {Object.entries(customAbbrs).length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No custom abbreviations</div>}
                  {Object.entries(customAbbrs).map(([name, code]) => (
                    <div class="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                      <span>{name} &rarr; <strong>{code}</strong></span>
                      <button class="btn" style={{ padding: '2px 6px', fontSize: '0.75rem', background: '#dc2626' }} onClick={()=>removeCustomAbbr(name)}>X</button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
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
