/**
 * Client half of the `@local/dsh-prompt-enhancer` bundle.
 *
 * Adds one compact control to the composer's right tool row. It reads the
 * current draft, streams a model rewrite from the Host route, and shows a
 * before/after dialog with replace and copy. Plain JavaScript on purpose: the
 * only shared module imports are React and ReactDOM.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-prompt-enhancer',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState, useSyncExternalStore } = React

    let ReactDOM = null
    try {
      ReactDOM = require('react-dom')
    } catch (error) {
      console.warn('[prompt-enhancer] react-dom unavailable; the dialog will render inline', error)
    }
    const createPortal =
      ReactDOM && typeof ReactDOM.createPortal === 'function' ? ReactDOM.createPortal : null

    const ENDPOINT = '/prompt-enhancer/enhance'

    const ZH = {
      buttonTitle: '增强提示词',
      buttonHint: '把当前草稿改写成更清晰、结构化的提示词',
      title: '增强提示词',
      subtitle: '补全上下文、明确目标与约束，并给出可执行的输出格式；确认后可一键替换。',
      original: '原始提示词',
      enhanced: '增强后',
      generating: '正在分析并改写…',
      empty: '增强结果会显示在这里',
      ready: '可直接编辑增强结果',
      retry: '重新生成',
      stop: '停止',
      copy: '复制',
      copied: '已复制增强结果',
      copyFailed: '复制失败，请手动选择文本复制',
      replace: '替换输入框',
      replaced: '已替换输入框内容',
      close: '关闭',
      stopped: '已停止生成，可以复制或替换已有内容',
      chars: '字',
      model: '模型',
      truncated: '已达到输出上限，结果可能不完整',
      errorEmpty: '模型没有返回内容，请重试',
      errorRequest: '增强服务暂时不可用，请稍后重试',
      errorNoModel: '当前会话还没有可用模型，请先在输入框下方选择模型',
      errorTooLong: '提示词过长，请缩短后再试',
    }

    const EN = {
      buttonTitle: 'Enhance prompt',
      buttonHint: 'Rewrite the current draft into a clearer, structured prompt',
      title: 'Enhance prompt',
      subtitle:
        'Fills in context, sharpens the goal and constraints, and proposes an executable output format. Replace the draft when it looks right.',
      original: 'Original',
      enhanced: 'Enhanced',
      generating: 'Analyzing and rewriting…',
      empty: 'The enhanced prompt will appear here',
      ready: 'You can edit the result before replacing',
      retry: 'Regenerate',
      stop: 'Stop',
      copy: 'Copy',
      copied: 'Enhanced prompt copied',
      copyFailed: 'Copy failed — select the text and copy manually',
      replace: 'Replace draft',
      replaced: 'Draft replaced',
      close: 'Close',
      stopped: 'Stopped — you can still copy or replace the partial result',
      chars: 'chars',
      model: 'Model',
      truncated: 'Output limit reached; the result may be incomplete',
      errorEmpty: 'The model returned no content. Please try again.',
      errorRequest: 'The enhancement service is unavailable. Please try again.',
      errorNoModel: 'No model is available for this session yet. Choose one below the composer first.',
      errorTooLong: 'The prompt is too long. Shorten it and try again.',
    }

    const CSS = `
.pe-slot{position:relative;display:inline-flex;align-items:center;justify-content:center}
.pe-button{position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s,color .12s,transform .12s}
.pe-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pe-button:active:not(:disabled){transform:scale(.94)}
.pe-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pe-button:disabled{opacity:.32;cursor:not-allowed;transform:none}
.pe-icon{display:block}
.pe-spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:pe-spin .8s linear infinite}
.pe-spinner-small{width:13px;height:13px}
.pe-spinner-inline{flex:none;width:11px;height:11px}
.pe-backdrop{position:fixed;inset:0;z-index:1600;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.46)}
.pe-dialog{width:min(920px,calc(100vw - 32px));max-height:min(86vh,860px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 24px 80px rgba(0,0,0,.35);font-size:13px}
.pe-dialog *{box-sizing:border-box}
.pe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.pe-headtext{min-width:0}
.pe-title{font-size:16px;font-weight:600;line-height:1.3}
.pe-sub{margin-top:5px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
.pe-close{flex:none;width:28px;height:28px;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;line-height:1;cursor:pointer}
.pe-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pe-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pe-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:14px;padding:14px 20px 4px;min-height:0;overflow:auto}
.pe-pane{display:flex;flex-direction:column;min-height:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.pe-pane-result{border-color:var(--dsw-alias-border-l2)}
.pe-panehead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.pe-panetitle{font-size:12px;font-weight:600;letter-spacing:.02em}
.pe-count{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.pe-text{width:100%;min-height:320px;max-height:min(48vh,520px);padding:14px;border:0;outline:none;resize:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.7;overflow:auto;white-space:pre-wrap}
.pe-original{color:var(--dsw-alias-label-secondary)}
.pe-text::placeholder{color:var(--dsw-alias-label-secondary);opacity:.62}
.pe-text:focus{box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2)}
.pe-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 20px 16px;flex-wrap:wrap}
.pe-status{flex:1 1 240px;min-height:18px;display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.pe-status-error{color:var(--dsw-alias-state-error-primary)}
.pe-status-ok{color:var(--dsw-alias-state-success-primary)}
.pe-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.pe-btn{height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.pe-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.pe-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pe-btn:disabled{opacity:.4;cursor:not-allowed}
.pe-btn-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:transparent}
.pe-btn-primary:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
@keyframes pe-spin{to{transform:rotate(360deg)}}
@keyframes pe-fade{from{opacity:0}to{opacity:1}}
@keyframes pe-rise{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){.pe-backdrop{animation:pe-fade .12s ease-out}.pe-dialog{animation:pe-rise .16s ease-out}}
@media (max-width:720px){.pe-backdrop{padding:10px}.pe-dialog{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}.pe-body{grid-template-columns:minmax(0,1fr);padding:12px 14px 4px}.pe-text{min-height:180px;max-height:32vh}.pe-foot{padding:12px 14px 14px}.pe-actions{width:100%;justify-content:flex-end}.pe-status{flex-basis:100%}}
`

    const selectDraft = (state) => (state && typeof state.draft === 'string' ? state.draft : '')

    function charCount(text) {
      return Array.from(String(text ?? '')).length
    }

    function isMacLike() {
      try {
        const platform = navigator.userAgentData?.platform || navigator.platform || ''
        return /mac|iphone|ipad|ipod/i.test(platform)
      } catch {
        return false
      }
    }

    const SPARKLE = h(
      'svg',
      {
        className: 'pe-icon',
        width: 15,
        height: 15,
        viewBox: '0 0 16 16',
        'aria-hidden': 'true',
      },
      h('path', {
        d: 'M7.1 1.6 8.35 5 11.8 6.25 8.35 7.5 7.1 10.9 5.85 7.5 2.4 6.25 5.85 5 7.1 1.6Z',
        fill: 'currentColor',
      }),
      h('path', {
        d: 'm12.2 9.2.72 1.88 1.88.72-1.88.72-.72 1.88-.72-1.88-1.88-.72 1.88-.72.72-1.88Z',
        fill: 'currentColor',
        opacity: '.72',
      }),
    )

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const registerLocale = (locale, dict) => {
          try {
            const create = () => ctx.locale.register('prompt-enhancer', locale, dict)
            if (typeof ctx.effect === 'function') return ctx.effect(create, `prompt-enhancer locale ${locale}`)
            return create()
          } catch (error) {
            console.warn('[prompt-enhancer] locale registration failed', error)
            return undefined
          }
        }
        registerLocale('zh', ZH)
        registerLocale('en', EN)

        let bound = null
        try {
          bound = ctx.locale.bind('prompt-enhancer')
        } catch (error) {
          console.warn('[prompt-enhancer] locale bind failed', error)
        }
        const tr = (key) => {
          try {
            const value = bound ? bound(key) : undefined
            if (typeof value === 'string' && value !== key) return value
          } catch {
            /* fall through to Chinese */
          }
          return ZH[key] ?? key
        }

        const useLocaleTick = () =>
          useSyncExternalStore(
            (listener) => ctx.locale.subscribe(listener),
            () => {
              const snapshot = ctx.locale.getSnapshot()
              return snapshot && typeof snapshot === 'object'
                ? snapshot.revision ?? snapshot.id ?? 0
                : 0
            },
          )

        function Enhancer(props) {
          useLocaleTick()

          const draft = props.useInput(selectDraft) || ''
          const draftRef = useRef(draft)
          draftRef.current = draft
          const sessionRef = useRef(props.sessionId)
          sessionRef.current = props.sessionId
          const actionsRef = useRef(props.inputActions)
          actionsRef.current = props.inputActions

          const [open, setOpen] = useState(false)
          const [phase, setPhase] = useState('idle')
          const [original, setOriginal] = useState('')
          const [enhanced, setEnhanced] = useState('')
          const [error, setError] = useState('')
          const [notice, setNotice] = useState('')
          const [model, setModel] = useState('')
          const [truncated, setTruncated] = useState(false)

          const requestRef = useRef(null)
          const beginRef = useRef(null)
          const openRef = useRef(false)
          openRef.current = open
          const closeRef = useRef(null)
          const resultRef = useRef(null)
          const timerRef = useRef(null)

          const abortRequest = () => {
            const controller = requestRef.current
            requestRef.current = null
            if (controller) controller.abort()
          }

          const close = () => {
            abortRequest()
            setOpen(false)
            setPhase((current) => (current === 'loading' ? 'idle' : current))
          }

          async function runRequest(text, controller) {
            try {
              const response = await fetch(ENDPOINT, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                  'content-type': 'application/json',
                  accept: 'application/x-ndjson',
                  'x-dsh-prompt-enhancer': '1',
                },
                body: JSON.stringify({
                  text,
                  sessionId: sessionRef.current ?? null,
                }),
                signal: controller.signal,
              })
              if (controller.signal.aborted) return
              if (!response.ok) {
                let message = tr('errorRequest')
                try {
                  const data = await response.json()
                  const code = data && typeof data.code === 'string' ? data.code : ''
                  if (code === 'too-long') message = tr('errorTooLong')
                  else if (code === 'no-model') message = tr('errorNoModel')
                  else if (data && data.error) message = String(data.error)
                } catch {
                  /* keep the generic message */
                }
                throw new Error(message)
              }

              const contentType = response.headers.get('content-type') || ''
              if (!response.body || !contentType.includes('ndjson')) {
                const data = await response.json()
                if (data && data.error) throw new Error(String(data.error))
                const textResult = typeof data?.text === 'string' ? data.text : ''
                if (!textResult.trim()) throw new Error(tr('errorEmpty'))
                setEnhanced(textResult)
                setPhase('ready')
                return
              }

              const reader = response.body.getReader()
              const decoder = new TextDecoder()
              let buffer = ''
              let acc = ''
              let finished = false

              const consume = (line) => {
                if (!line || finished) return
                let message
                try {
                  message = JSON.parse(line)
                } catch {
                  return
                }
                if (!message || typeof message.type !== 'string') return
                if (message.type === 'start') {
                  if (message.model) setModel(String(message.model))
                  return
                }
                if (message.type === 'delta' && typeof message.text === 'string') {
                  acc += message.text
                  setEnhanced(acc)
                  return
                }
                if (message.type === 'done') {
                  if (typeof message.text === 'string' && message.text.length > 0) acc = message.text
                  setEnhanced(acc)
                  setTruncated(Boolean(message.truncated) || message.finish === 'max-tokens')
                  setPhase('ready')
                  finished = true
                  return
                }
                if (message.type === 'error') {
                  if (typeof message.text === 'string' && message.text.trim()) {
                    acc = message.text
                    setEnhanced(acc)
                  }
                  const messageCode = typeof message.code === 'string' ? message.code : ''
                  setError(
                    messageCode === 'empty-result'
                      ? tr('errorEmpty')
                      : String(message.error || tr('errorRequest')),
                  )
                  setPhase('error')
                  finished = true
                }
              }

              while (!finished) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                let index
                while ((index = buffer.indexOf('\n')) >= 0) {
                  const line = buffer.slice(0, index).trim()
                  buffer = buffer.slice(index + 1)
                  consume(line)
                  if (finished) break
                }
              }

              if (finished) {
                try {
                  await reader.cancel()
                } catch {
                  /* already settled */
                }
                return
              }
              if (controller.signal.aborted) return

              buffer += decoder.decode()
              if (buffer.trim()) consume(buffer.trim())

              if (!finished) {
                if (!acc.trim()) {
                  setError(tr('errorEmpty'))
                  setPhase('error')
                } else {
                  setPhase('ready')
                }
              }
            } catch (caught) {
              if (controller.signal.aborted) return
              setError(caught?.message ? String(caught.message) : tr('errorRequest'))
              setPhase('error')
            } finally {
              if (requestRef.current === controller) requestRef.current = null
            }
          }

          const begin = (text) => {
            const source = String(text ?? '')
            if (!source.trim()) return
            abortRequest()
            const controller = new AbortController()
            requestRef.current = controller
            setOpen(true)
            setPhase('loading')
            setOriginal(source)
            setEnhanced('')
            setError('')
            setNotice('')
            setModel('')
            setTruncated(false)
            void runRequest(source, controller)
          }
          beginRef.current = begin

          const stop = () => {
            abortRequest()
            setPhase(enhanced.trim() ? 'ready' : 'idle')
            setNotice(tr('stopped'))
          }

          const copy = async () => {
            if (!enhanced) return
            try {
              await navigator.clipboard.writeText(enhanced)
              setError('')
              setNotice(tr('copied'))
            } catch {
              try {
                const node = resultRef.current
                if (!node) throw new Error('no target')
                node.focus()
                node.select()
                if (!document.execCommand('copy')) throw new Error('copy rejected')
                setError('')
                setNotice(tr('copied'))
              } catch {
                setNotice('')
                setError(tr('copyFailed'))
              }
            }
          }

          const replace = () => {
            const text = enhanced
            if (!text) return
            const actions = actionsRef.current
            try {
              if (actions && typeof actions.setDraft === 'function') {
                actions.setDraft(text)
                setError('')
                setNotice(tr('replaced'))
                if (timerRef.current) clearTimeout(timerRef.current)
                timerRef.current = setTimeout(() => {
                  timerRef.current = null
                  close()
                }, 620)
                return
              }
            } catch (caught) {
              setNotice('')
              setError(caught?.message ? String(caught.message) : tr('errorRequest'))
              return
            }
            void copy()
          }

          useEffect(() => {
            const onKeyDown = (event) => {
              if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return
              if (event.key !== 'e' && event.key !== 'E') return
              const target = event.target
              const active = document.activeElement
              const targetEditable =
                target &&
                (target.isContentEditable ||
                  (target.tagName && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')))
              if (!targetEditable && !(active && active.isContentEditable)) return
              if (target && target.closest && target.closest('.pe-backdrop')) return
              if (openRef.current) return
              const text = draftRef.current
              if (!text || !text.trim()) return
              event.preventDefault()
              event.stopPropagation()
              beginRef.current?.(text)
            }
            document.addEventListener('keydown', onKeyDown, true)
            return () => document.removeEventListener('keydown', onKeyDown, true)
          }, [])

          useEffect(() => {
            if (!open) return undefined
            const previousOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            const focusTimer = setTimeout(() => closeRef.current?.focus?.(), 0)
            const onKeyDown = (event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              closeRef.current?.click?.()
            }
            document.addEventListener('keydown', onKeyDown, true)
            return () => {
              clearTimeout(focusTimer)
              document.removeEventListener('keydown', onKeyDown, true)
              document.body.style.overflow = previousOverflow
            }
          }, [open])

          useEffect(
            () => () => {
              const controller = requestRef.current
              if (controller) controller.abort()
              if (timerRef.current) clearTimeout(timerRef.current)
            },
            [],
          )

          const disabled = !draft.trim() || open
          const shortcutLabel = isMacLike() ? '⌘⇧E' : 'Ctrl+Shift+E'
          const loading = phase === 'loading'

          const button = h(
            'div',
            { className: 'pe-slot' },
            h(
              'button',
              {
                type: 'button',
                className: 'pe-button',
                title: `${tr('buttonTitle')} · ${shortcutLabel}`,
                'aria-label': tr('buttonTitle'),
                'aria-keyshortcuts': 'Control+Shift+E Meta+Shift+E',
                disabled,
                onMouseDown: (event) => event.preventDefault(),
                onClick: () => {
                  if (!draft.trim() || open) return
                  begin(draft)
                },
              },
              loading ? h('span', { className: 'pe-spinner pe-spinner-small' }) : SPARKLE,
            ),
          )

          const status = error
            ? h('span', null, error)
            : notice
              ? h('span', null, notice)
              : truncated
                ? h('span', null, tr('truncated'))
                : loading
                  ? h(React.Fragment, null, h('span', { className: 'pe-spinner pe-spinner-inline' }), tr('generating'))
                  : model
                    ? h('span', null, `${tr('model')} · ${model}`)
                    : h('span', null, tr('ready'))

          const dialog = open
            ? h(
                'div',
                {
                  className: 'pe-backdrop',
                  onMouseDown: (event) => {
                    if (event.target === event.currentTarget) close()
                  },
                },
                h(
                  'div',
                  {
                    className: 'pe-dialog',
                    role: 'dialog',
                    'aria-modal': 'true',
                    'aria-labelledby': 'pe-title',
                  },
                  h(
                    'div',
                    { className: 'pe-head' },
                    h(
                      'div',
                      { className: 'pe-headtext' },
                      h('div', { className: 'pe-title', id: 'pe-title' }, tr('title')),
                      h('div', { className: 'pe-sub' }, tr('subtitle')),
                    ),
                    h(
                      'button',
                      {
                        ref: closeRef,
                        type: 'button',
                        className: 'pe-close',
                        title: tr('close'),
                        'aria-label': tr('close'),
                        onClick: close,
                      },
                      '✕',
                    ),
                  ),
                  h(
                    'div',
                    { className: 'pe-body' },
                    h(
                      'section',
                      { className: 'pe-pane' },
                      h(
                        'div',
                        { className: 'pe-panehead' },
                        h('span', { className: 'pe-panetitle' }, tr('original')),
                        h('span', { className: 'pe-count' }, `${charCount(original)} ${tr('chars')}`),
                      ),
                      h('textarea', {
                        className: 'pe-text pe-original',
                        readOnly: true,
                        spellCheck: false,
                        value: original,
                        'aria-label': tr('original'),
                      }),
                    ),
                    h(
                      'section',
                      { className: 'pe-pane pe-pane-result' },
                      h(
                        'div',
                        { className: 'pe-panehead' },
                        h('span', { className: 'pe-panetitle' }, tr('enhanced')),
                        loading ? h('span', { className: 'pe-spinner' }) : null,
                        h('span', { className: 'pe-count' }, `${charCount(enhanced)} ${tr('chars')}`),
                      ),
                      h('textarea', {
                        ref: resultRef,
                        className: 'pe-text',
                        readOnly: loading,
                        spellCheck: false,
                        value: enhanced,
                        placeholder: loading ? tr('generating') : tr('empty'),
                        'aria-label': tr('enhanced'),
                        onChange: (event) => {
                          setEnhanced(event.target.value)
                          setError('')
                          setNotice('')
                          setTruncated(false)
                        },
                      }),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'pe-foot' },
                    h(
                      'div',
                      {
                        className: `pe-status${error ? ' pe-status-error' : notice ? ' pe-status-ok' : ''}`,
                        role: error ? 'alert' : 'status',
                      },
                      status,
                    ),
                    h(
                      'div',
                      { className: 'pe-actions' },
                      loading
                        ? h('button', { type: 'button', className: 'pe-btn', onClick: stop }, tr('stop'))
                        : h(
                            'button',
                            {
                              type: 'button',
                              className: 'pe-btn',
                              onClick: () => begin(original),
                              disabled: !original.trim(),
                            },
                            tr('retry'),
                          ),
                      h(
                        'button',
                        { type: 'button', className: 'pe-btn', onClick: copy, disabled: !enhanced },
                        tr('copy'),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'pe-btn pe-btn-primary',
                          onClick: replace,
                          disabled: !enhanced,
                        },
                        tr('replace'),
                      ),
                      h('button', { type: 'button', className: 'pe-btn', onClick: close }, tr('close')),
                    ),
                  ),
                ),
              )
            : null

          return h(
            React.Fragment,
            null,
            h('style', null, CSS),
            button,
            dialog && createPortal ? createPortal(dialog, document.body) : dialog,
          )
        }

        ctx.slots.inject('conversation.input.right', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.right',
              id: 'prompt-enhancer',
              order: 20,
              label: () => tr('buttonTitle'),
            },
            Enhancer,
          ),
        )
      },
    }
  },
})
