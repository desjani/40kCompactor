import { render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import * as AnsiUpNS from 'ansi_up'
import * as htmlToImage from 'html-to-image'
import './style.css'

if (typeof window !== 'undefined') {
  (window as any).htmlToImage = htmlToImage;
}

// Import shared modules from repo root
// @ts-ignore - ambient types provided separately for JS modules
import * as parsers from '../../../modules/parsers.js'
// @ts-ignore - ambient types provided separately for JS modules
import { generateOutput, generateDiscordText } from '../../../modules/renderers.js'
// @ts-ignore - ambient types provided separately for JS modules
import { buildAbbreviationIndex } from '../../../modules/abbreviations.js'
// @ts-ignore
import { downloadCardPng, generateCardPngDataUrl, estimateCardWidth, copyCardImageToClipboard } from '../../../modules/cardRenderer.js'
import skippable from '../../../skippable_wargear.json'

function useLocalStorage<T>(key: string, initial: T): [T, (v: T)=>void] {
  const [val, setVal] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }, [key, val])
  return [val, setVal]
}

function App() {
  const [tab, setTab] = useLocalStorage<any>('tab', 0)
  const step = useMemo(() => {
    if (tab === 'input' || tab === 'ingest' || tab === 0) return 0;
    if (tab === 'compact' || tab === 'refine' || tab === 1) return 1;
    if (tab === 'full' || tab === 'export' || tab === 2) return 2;
    return 0;
  }, [tab])
  const [text, setText] = useLocalStorage('text','')
  const [showSubunits, setShowSubunits] = useLocalStorage('showSubunits', false)
  const [combine, setCombine] = useLocalStorage('combine', false)
  const [multiline, setMultiline] = useLocalStorage('multiline', false)
  const [abbrHeader, setAbbrHeader] = useLocalStorage('abbrHeader', false)
  const [noBullets, setNoBullets] = useLocalStorage('noBullets', false)
  const [hidePoints, setHidePoints] = useLocalStorage('hidePoints', false)
  const [hideBrackets, setHideBrackets] = useLocalStorage('hideBrackets', false)
  const [abbrUnitNames, setAbbrUnitNames] = useLocalStorage('abbrUnitNames', false)
  const [wargearMode, setWargearMode] = useLocalStorage<'show-all'|'hide-mandatory'|'hide-all'>('wargearMode', (() => {
    try {
      const legacy = localStorage.getItem('showMandatory');
      if (legacy !== null) {
        const parsedLegacy = JSON.parse(legacy);
        localStorage.removeItem('showMandatory');
        return parsedLegacy ? 'show-all' : 'hide-mandatory';
      }
    } catch {}
    return 'hide-mandatory';
  })())
  const [customAbbrs, setCustomAbbrs] = useLocalStorage<Record<string,string>>('customAbbrs', {})
  const [colorMode, setColorMode] = useLocalStorage<'none'|'custom'|'faction'>('colorMode', 'faction')
  const [colors, setColors] = useLocalStorage('colors', { unit:'#ffffff', subunit:'#808080', wargear:'#ffffff', points:'#ffff00', header:'#ffff00', attached:'#ffff00' })
  const [format, setFormat] = useLocalStorage<'discordCompact'|'discordExtended'|'plainText'|'plainTextExtended'|'imageCodex'|'imageCodexAbbr'>('format','discordCompact')
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [renderingImage, setRenderingImage] = useState(false)
  const [copyingImage, setCopyingImage] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)

  // Temporary state for adding new abbreviations
  const [newAbbrName, setNewAbbrName] = useState('')
  const [newAbbrCode, setNewAbbrCode] = useState('')

  const parsed = useMemo(() => {
    if (!text.trim()) return null
    const lines = text.split(/\r?\n/)
    const fmt = parsers.detectFormat(lines)
    const parseFn = {
      'V11_GENERIC': parsers.parseV11List,
      'GW_APP_V11': parsers.parseGwAppV11,
      'WAR_ORGAN_V11': parsers.parseWarOrganV11
    }[fmt]
    if (!parseFn) return null
    try { return parseFn(lines, skippable as any) } catch { return null }
  }, [text])

  const abbr = useMemo(() => parsed ? buildAbbreviationIndex(parsed, customAbbrs) : null, [parsed, customAbbrs])

  const fullText = useMemo(() => {
    if (!parsed || !abbr) return ''
    return generateOutput(parsed, false, abbr, false, skippable as any, false, false, false, false, abbrHeader, true, undefined, abbrUnitNames, hideBrackets).plainText
  }, [parsed, abbr, abbrHeader, abbrUnitNames, hideBrackets])

  const compactText = useMemo(() => {
    if (!parsed || !abbr) return ''
    return generateOutput(parsed, true, abbr, !showSubunits, skippable as any, true, combine, noBullets, hidePoints, abbrHeader, false, wargearMode, abbrUnitNames, hideBrackets).plainText
  }, [parsed, abbr, showSubunits, combine, noBullets, hidePoints, abbrHeader, wargearMode, abbrUnitNames, hideBrackets])

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
    if (!parsed || !abbr) { setPreviewText(''); setImagePreviewUrl(''); return }
    if (format === 'imageCodex' || format === 'imageCodexAbbr') {
      setPreviewText('');
      setRenderingImage(true);
      let active = true;
      generateCardPngDataUrl(parsed, {
        hideSubunits: !showSubunits,
        wargearShowMode: wargearMode,
        hidePoints: hidePoints,
        hideBrackets: hideBrackets,
        combineIdenticalUnits: combine,
        useAbbreviations: format === 'imageCodexAbbr',
        wargearAbbrMap: abbr,
        colorMode,
        colors: {
          ...colors,
          icon: (colors as any).icon || colors.header
        },
        abbreviateHeader: abbrHeader,
        abbreviateUnitNames: abbrUnitNames
      }).then(dataUrl => {
        if (active) {
          setImagePreviewUrl(dataUrl);
          setRenderingImage(false);
        }
      }).catch(err => {
        console.error('Failed to render mobile image preview:', err);
        if (active) {
          setRenderingImage(false);
        }
      });
      return () => {
        active = false;
      };
    }
    let t = ''
    const opts = { colorMode, colors, multilineHeader: multiline, abbreviateHeader: abbrHeader, wargearShowMode: wargearMode, abbreviateUnitNames: abbrUnitNames, hideBrackets: hideBrackets } as any
    switch (format) {
      case 'discordCompact':
        t = generateDiscordText(parsed, false, true, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'discordExtended':
        t = generateDiscordText(parsed, false, false, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainText':
        t = generateDiscordText(parsed, true, true, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainTextExtended':
        t = generateDiscordText(parsed, true, false, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      default:
        t = generateDiscordText(parsed, false, true, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints)
    }
    setPreviewText(t)
  }, [parsed, abbr, showSubunits, combine, colorMode, colors, multiline, format, noBullets, hidePoints, hideBrackets, abbrHeader, wargearMode, abbrUnitNames])

  const previewHtml = useMemo(() => {
    if (format === 'imageCodex' || format === 'imageCodexAbbr') {
      if (renderingImage) {
        return '<div style="color: #aab; text-align: center; padding: 20px;">Generating preview image...</div>';
      }
      if (imagePreviewUrl) {
        const cardWidth = parsed ? estimateCardWidth(parsed, {
          hideSubunits: !showSubunits,
          wargearShowMode: wargearMode,
          hidePoints: hidePoints,
          hideBrackets: hideBrackets,
          combineIdenticalUnits: combine,
          useAbbreviations: format === 'imageCodexAbbr',
          wargearAbbrMap: abbr,
          abbreviateHeader: abbrHeader,
          abbreviateUnitNames: abbrUnitNames
        }) : 580;
        return `<img src="${imagePreviewUrl}" style="width: ${cardWidth}px; max-width: none; display: block; border-radius: 6px;" />`;
      }
      return '<div style="color: #aab; text-align: center; padding: 20px;">No preview generated.</div>';
    }
    return au.ansi_to_html(previewText);
  }, [format, renderingImage, imagePreviewUrl, previewText, au, parsed, showSubunits, wargearMode, hidePoints, hideBrackets, combine, abbr, abbrHeader, abbrUnitNames]);

  function copy(s: string) {
    if (!s || !parsed || !abbr) { navigator.clipboard?.writeText(s || ''); return }
    const opts: any = { colorMode, colors, forcePalette: true, multilineHeader: multiline, abbreviateHeader: abbrHeader, wargearShowMode: wargearMode, abbreviateUnitNames: abbrUnitNames, hideBrackets: hideBrackets }
    let t = ''
    switch (format) {
      case 'discordCompact':
        t = generateDiscordText(parsed, false, true, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'discordExtended':
        t = generateDiscordText(parsed, false, false, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainText':
        t = generateDiscordText(parsed, true, true, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      case 'plainTextExtended':
        t = generateDiscordText(parsed, true, false, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints); break
      default:
        t = generateDiscordText(parsed, false, true, abbr, !showSubunits, skippable as any, combine, opts, noBullets, hidePoints)
    }
    navigator.clipboard?.writeText(t)
  }

  function handleDownloadImage() {
    if (!parsed) return
    downloadCardPng(parsed, {
      hideSubunits: !showSubunits,
      wargearShowMode: wargearMode,
      hidePoints: hidePoints,
      hideBrackets: hideBrackets,
      combineIdenticalUnits: combine,
      useAbbreviations: format === 'imageCodex' ? false : (format === 'imageCodexAbbr'),
      wargearAbbrMap: abbr,
      colorMode,
      colors: {
        ...colors,
        icon: (colors as any).icon || colors.header
      },
      abbreviateHeader: abbrHeader,
      abbreviateUnitNames: abbrUnitNames
    })
  }

  async function handleCopyImage() {
    if (!parsed) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || !(window as any).ClipboardItem) {
      alert('Copying images to clipboard is not supported on this mobile device or browser. Please use Download or Share instead.');
      return;
    }
    try {
      setCopyingImage(true);
      await copyCardImageToClipboard(parsed, {
        hideSubunits: !showSubunits,
        wargearShowMode: wargearMode,
        hidePoints: hidePoints,
        hideBrackets: hideBrackets,
        combineIdenticalUnits: combine,
        useAbbreviations: format === 'imageCodex' ? false : (format === 'imageCodexAbbr'),
        wargearAbbrMap: abbr,
        colorMode,
        colors: {
          ...colors,
          icon: (colors as any).icon || colors.header
        },
        abbreviateHeader: abbrHeader,
        abbreviateUnitNames: abbrUnitNames
      });
      alert('Image copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy image:', err);
      alert('Failed to copy image to clipboard. Access might be restricted or unsupported on this browser.');
    } finally {
      setCopyingImage(false);
    }
  }

  async function handleShareImage() {
    if (!parsed) return;
    if (typeof navigator === 'undefined' || !navigator.share) {
      alert('System sharing is not supported by your browser in this context. Note: Mobile browsers restrict system sharing APIs to secure contexts (HTTPS) or localhost. Please use "[ Download Image ]" instead.');
      return;
    }
    try {
      setSharingImage(true);
      const dataUrl = await generateCardPngDataUrl(parsed, {
        hideSubunits: !showSubunits,
        wargearShowMode: wargearMode,
        hidePoints: hidePoints,
        hideBrackets: hideBrackets,
        combineIdenticalUnits: combine,
        useAbbreviations: format === 'imageCodex' ? false : (format === 'imageCodexAbbr'),
        wargearAbbrMap: abbr,
        colorMode,
        colors: {
          ...colors,
          icon: (colors as any).icon || colors.header
        },
        abbreviateHeader: abbrHeader,
        abbreviateUnitNames: abbrUnitNames
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const armyName = (parsed.metadata?.title || parsed.metadata?.armyName || 'army-list').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const file = new File([blob], `${armyName}-card.png`, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: parsed.metadata?.title || 'Warhammer 40k Army List',
          text: 'Compacted Warhammer 40k army list card.'
        });
      } else {
        await navigator.share({
          title: parsed.metadata?.title || 'Warhammer 40k Army List',
          text: compactText || 'Compacted Warhammer 40k army list.'
        });
      }
    } catch (err) {
      console.error('Failed to share image:', err);
      // Don't alert on user cancel, only real errors
      if (err instanceof Error && err.name !== 'AbortError') {
        alert('Failed to trigger system sharing.');
      }
    } finally {
      setSharingImage(false);
    }
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
          <strong style={{ color: '#22c55e', textShadow: '0 0 6px rgba(34,197,94,0.4)', letterSpacing: '1px' }}>40K COMPACTOR [COGITATOR V2.0]</strong>
          <span class="pill">MOBILE HUD</span>
        </div>
        <div style={{ textAlign: 'center', background: '#11141a', padding: '6px', fontSize: '10px', marginTop: '6px', border: '1px solid #1f2833' }}>
          <a href="../../../v10/apps/mobile-ui/dist/index.html" style={{ color: '#45f3ff', textDecoration: 'none', textShadow: '0 0 2px rgba(69,243,255,0.3)' }}>[ SWITCH TO V10 LEGACY MOBILE ]</a>
        </div>
      </header>

      {/* Progress tracker */}
      <div class="progress-tracker">
        <span class={`progress-step ${step === 0 ? 'active' : ''}`} onClick={() => setTab(0)} style={{ cursor: 'pointer' }}>01. INGEST</span>
        <span class="progress-arrow">---&gt;</span>
        <span class={`progress-step ${step === 1 ? 'active' : ''}`} onClick={() => text.trim() ? setTab(1) : null} style={{ cursor: text.trim() ? 'pointer' : 'not-allowed' }}>02. REFINE</span>
        <span class="progress-arrow">---&gt;</span>
        <span class={`progress-step ${step === 2 ? 'active' : ''}`} onClick={() => text.trim() ? setTab(2) : null} style={{ cursor: text.trim() ? 'pointer' : 'not-allowed' }}>03. EXPORT</span>
      </div>

      {/* Carousel Container */}
      <div class="carousel-viewport">
        <div class="carousel-track" style={{ transform: `translateX(-${step * 33.3333}%)` }}>
          
          {/* Slide 1: Ingest */}
          <div class="carousel-slide">
            <div class="tactical-panel">
              <div class="section" style={{ marginTop: 0 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  // INGEST ARMY LIST
                </label>
                <textarea 
                  placeholder="Paste your Warhammer 40k list here (GW App, War Organ)..." 
                  value={text} 
                  onInput={(e: any) => setText(e.currentTarget.value)} 
                />
                <div class="row" style={{ marginTop: '12px', justifyContent: 'space-between' }}>
                  <span class="pill">{text.length} characters</span>
                  <button class="btn" onClick={() => setText('')}>[ Clear ]</button>
                </div>
              </div>
            </div>

            <div class="row" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
              <button 
                class="btn" 
                disabled={!text.trim()} 
                onClick={() => setTab(1)}
                style={{ fontSize: '13px', padding: '10px 18px' }}
              >
                [ Proceed to Refine ]
              </button>
            </div>
          </div>

          {/* Slide 2: Refine */}
          <div class="carousel-slide">
            <div class="tactical-panel">
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '12px', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px' }}>
                // COGITATOR REFINEMENT PARAMETERS
              </label>
              
              {/* Format selection */}
              <div class="section" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>OUTPUT FORMAT:</label>
                <select value={format} onChange={e => setFormat((e.target as HTMLSelectElement).value as any)}>
                  <option value="discordCompact">Discord (Compact)</option>
                  <option value="discordExtended">Discord (Extended)</option>
                  <option value="plainText">Plain Text (Compact)</option>
                  <option value="plainTextExtended">Plain Text (Extended)</option>
                  <option value="imageCodex">Image (Codex Card)</option>
                  <option value="imageCodexAbbr">Image (Codex Card Abbreviated)</option>
                </select>
              </div>

              {/* Option switches */}
              <div class="section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label>COMPACTOR PARAMETERS:</label>
                
                {!(format === 'imageCodex' || format === 'imageCodexAbbr') && (
                  <label class="switch-container">
                    <input type="checkbox" class="tactical-switch" checked={multiline} onChange={e => setMultiline((e.target as HTMLInputElement).checked)} />
                    <span class="switch-slider"></span>
                    <span class="switch-label">Multiline Header</span>
                  </label>
                )}
                
                <label class="switch-container">
                  <input type="checkbox" class="tactical-switch" checked={abbrHeader} onChange={e => setAbbrHeader((e.target as HTMLInputElement).checked)} />
                  <span class="switch-slider"></span>
                  <span class="switch-label">Abbreviate Header</span>
                </label>
                
                <label class="switch-container">
                  <input type="checkbox" class="tactical-switch" checked={abbrUnitNames} onChange={e => setAbbrUnitNames((e.target as HTMLInputElement).checked)} />
                  <span class="switch-slider"></span>
                  <span class="switch-label">Abbreviate unit and subunit names</span>
                </label>
                
                <label class="switch-container">
                  <input type="checkbox" class="tactical-switch" checked={combine} onChange={e => setCombine((e.target as HTMLInputElement).checked)} />
                  <span class="switch-slider"></span>
                  <span class="switch-label">Combine Identical Units</span>
                </label>
                
                <label class="switch-container">
                  <input type="checkbox" class="tactical-switch" checked={showSubunits} onChange={e => setShowSubunits((e.target as HTMLInputElement).checked)} />
                  <span class="switch-slider"></span>
                  <span class="switch-label">Show Subunits</span>
                </label>
                
                {!(format === 'imageCodex' || format === 'imageCodexAbbr') && (
                  <label class="switch-container">
                    <input type="checkbox" class="tactical-switch" checked={noBullets} onChange={e => setNoBullets((e.target as HTMLInputElement).checked)} />
                    <span class="switch-slider"></span>
                    <span class="switch-label">Hide Bullets</span>
                  </label>
                )}
                
                <label class="switch-container">
                  <input type="checkbox" class="tactical-switch" checked={hidePoints} onChange={e => setHidePoints((e.target as HTMLInputElement).checked)} />
                  <span class="switch-slider"></span>
                  <span class="switch-label">Hide Points</span>
                </label>
                
                <label class="switch-container">
                  <input type="checkbox" class="tactical-switch" checked={hideBrackets} onChange={e => setHideBrackets((e.target as HTMLInputElement).checked)} />
                  <span class="switch-slider"></span>
                  <span class="switch-label">Hide brackets and parentheses</span>
                </label>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <label style={{ flexShrink: 0 }}>Wargear Show Mode:</label>
                  <select value={wargearMode} onChange={e => setWargearMode((e.target as HTMLSelectElement).value as any)} style={{ flexGrow: 1 }}>
                    <option value="show-all">Show All</option>
                    <option value="hide-mandatory">Hide Mandatory</option>
                    <option value="hide-all">Hide All</option>
                  </select>
                </div>
              </div>

              {/* Color modes/pickers */}
              <div class="section" style={{ borderTop: '1px solid #1f2833', paddingTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>COLOR ACCENTS MODE:</label>
                <div class="row" style={{ gap: '12px' }}>
                  <label class="switch-container">
                    <input type="radio" name="colorMode" class="tactical-switch" checked={colorMode === 'none'} onChange={() => setColorMode('none')} />
                    <span class="switch-slider"></span>
                    <span class="switch-label">None</span>
                  </label>
                  <label class="switch-container">
                    <input type="radio" name="colorMode" class="tactical-switch" checked={colorMode === 'custom'} onChange={() => setColorMode('custom')} />
                    <span class="switch-slider"></span>
                    <span class="switch-label">Custom</span>
                  </label>
                  <label class="switch-container">
                    <input type="radio" name="colorMode" class="tactical-switch" checked={colorMode === 'faction'} onChange={() => setColorMode('faction')} />
                    <span class="switch-slider"></span>
                    <span class="switch-label">Faction</span>
                  </label>
                </div>
                
                {colorMode === 'custom' && (
                  <div class="grid2" style={{ marginTop: '10px', background: '#0b0c10', padding: '8px', border: '1px solid #1f2833' }}>
                    {(
                      (format === 'imageCodex' || format === 'imageCodexAbbr')
                        ? ['unit', 'subunit', 'wargear', 'points', 'header', 'attached', 'icon']
                        : ['unit', 'subunit', 'wargear', 'points', 'header', 'attached']
                    ).map(k => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ textTransform: 'capitalize' }}>{k}:</label>
                        <input 
                          type="color" 
                          value={(colors as any)[k] || (colors as any).header || '#ffffff'} 
                          onChange={e => setColors({ ...colors, [k]: (e.target as HTMLInputElement).value })} 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Abbreviations Details list */}
              <div class="section" style={{ borderTop: '1px solid #1f2833', paddingTop: '10px' }}>
                <details>
                  <summary style={{ cursor: 'pointer', marginBottom: '8px', color: '#45f3ff', fontWeight: 'bold' }}>
                    [ + CUSTOM ABBREVIATIONS ]
                  </summary>
                  <div class="row" style={{ gap: '6px', marginBottom: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Name (e.g. Plasma Pistol)" 
                      value={newAbbrName} 
                      onInput={(e: any) => setNewAbbrName(e.currentTarget.value)} 
                      style={{ flex: 2 }} 
                    />
                    <input 
                      type="text" 
                      placeholder="Abbr" 
                      value={newAbbrCode} 
                      onInput={(e: any) => setNewAbbrCode(e.currentTarget.value)} 
                      style={{ flex: 1 }} 
                    />
                    <button class="btn" onClick={addCustomAbbr} style={{ padding: '6px 10px' }}>+</button>
                  </div>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '11px', border: '1px solid #1f2833', padding: '6px', background: '#0b0c10' }}>
                    {Object.entries(customAbbrs).length === 0 && (
                      <div style={{ color: '#4f5e71', fontStyle: 'italic' }}>No custom abbreviations set.</div>
                    )}
                    {Object.entries(customAbbrs).map(([name, code]) => (
                      <div key={name} class="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px dashed #1f2833' }}>
                        <span>{name} &rarr; <strong style={{ color: '#22c55e' }}>{code}</strong></span>
                        <button 
                          class="btn" 
                          style={{ padding: '2px 6px', fontSize: '9px', borderColor: '#ef4444', color: '#ef4444', textShadow: 'none' }} 
                          onClick={() => removeCustomAbbr(name)}
                        >
                          [X]
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>

            {/* Navigation buttons */}
            <div class="row" style={{ justifyContent: 'space-between', marginTop: '12px' }}>
              <button class="btn" onClick={() => setTab(0)}>[ &lt; Ingest ]</button>
              <button class="btn" onClick={() => setTab(2)} style={{ color: '#45f3ff', borderColor: '#45f3ff', textShadow: '0 0 4px rgba(69, 243, 255, 0.4)' }}>
                [ Export &gt; ]
              </button>
            </div>
          </div>

          {/* Slide 3: Export */}
          <div class="carousel-slide">
            <div class="tactical-panel">
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px' }}>
                // EXPORT VIEWPORT
              </label>
              
              {/* Primary preview (ANSI text or image) */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>COMPACTED PREVIEW ({format.toUpperCase()}):</label>
                <div 
                  class="outbox" 
                  id="markdownPreviewOutput" 
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  style={{ 
                    maxHeight: '40vh', 
                    overflow: 'auto',
                    background: '#161b2a',
                    border: '1px solid #1f2833'
                  }}
                ></div>
              </div>
              
              {/* Action buttons for primary preview */}
              <div class="row" style={{ justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                {(format === 'imageCodex' || format === 'imageCodexAbbr') ? (
                  <>
                    <button class="btn" style={{ borderColor: '#45f3ff', color: '#45f3ff', textShadow: '0 0 4px rgba(69, 243, 255, 0.4)' }} onClick={handleDownloadImage}>
                      [ Download Image ]
                    </button>
                    <button class="btn" onClick={handleCopyImage}>
                      {copyingImage ? '[ Copying... ]' : '[ Copy Image ]'}
                    </button>
                    <button class="btn" style={{ borderColor: '#22c55e', color: '#22c55e', textShadow: '0 0 4px rgba(34, 197, 94, 0.4)' }} onClick={handleShareImage}>
                      {sharingImage ? '[ Sharing... ]' : '[ Share Image ]'}
                    </button>
                  </>
                ) : (
                  <button class="btn" onClick={() => copy(previewText)}>
                    [ Copy to Clipboard ]
                  </button>
                )}
              </div>
              
              {/* Full text preview (plain text) */}
              <div style={{ borderTop: '1px solid #1f2833', paddingTop: '12px' }}>
                <details>
                  <summary style={{ cursor: 'pointer', color: '#45f3ff', fontWeight: 'bold', fontSize: '11px', marginBottom: '8px' }}>
                    [ + PLAIN TEXT / RAW OUTPUT ]
                  </summary>
                  <textarea 
                    readOnly 
                    value={format.startsWith('discord') ? previewText : compactText || fullText} 
                    style={{ height: '120px', minHeight: '120px', background: '#0b0c10', fontSize: '11px' }} 
                  />
                  <div class="row" style={{ justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button class="btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => copy(format.startsWith('discord') ? previewText : compactText || fullText)}>
                      [ Copy Raw Text ]
                    </button>
                  </div>
                </details>
              </div>
            </div>
            
            {/* Navigation back */}
            <div class="row" style={{ justifyContent: 'flex-start', marginTop: '12px' }}>
              <button class="btn" onClick={() => setTab(1)}>[ &lt; Adjust Options ]</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

render(<App />, document.getElementById('app')!)
