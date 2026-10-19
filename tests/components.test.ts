import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HSwitch, HSlider, HTabs, HTabPanels } from '../src/lib/components'
import { node, renderer, descendants } from './node-renderer'
beforeEach(() => {
    vi.stubGlobal('document', { activeElement: null })
    vi.stubGlobal('Document', class {})
    vi.stubGlobal('ShadowRoot', class {})
})
afterEach(() => vi.unstubAllGlobals())
const disposals: (() => void)[] = []
afterEach(() => disposals.splice(0).forEach((dispose) => dispose()))
function mount(component: ReturnType<typeof defineComponent>) {
    const root = node('root')
    const app = renderer.createApp(component)
    app.mount(root)
    disposals.push(() => app.unmount())
    return () => descendants(root)
}
describe('compatible component extensions', () => {
    it('keeps switches labelled and toggles their model with or without an icon slot', async () => {
        const enabled = ref(true)
        const nodes = mount(
            defineComponent(
                () => () =>
                    h(
                        HSwitch,
                        {
                            label: 'Trait ≥7',
                            modelValue: enabled.value,
                            'onUpdate:modelValue': (value) => (enabled.value = value),
                        },
                        { icon: () => h('img', { alt: '', src: 'trait.webp' }) },
                    ),
            ),
        )
        const button = nodes().find((n) => n.props.role === 'switch')!
        expect(button.props['aria-label']).toBe('Trait ≥7')
        expect(button.props['aria-checked']).toBe(true)
        expect(nodes().filter((n) => n.type === 'img')).toHaveLength(1)
        ;(button.props.onClick as () => void)()
        await nextTick()
        expect(enabled.value).toBe(false)
        expect(button.props['aria-checked']).toBe(false)
    })
    it('localizes slider controls, forwards input associations and clamps at bounds', async () => {
        const quantity = ref(12)
        const nodes = mount(
            defineComponent(
                () => () =>
                    h(HSlider, {
                        label: 'Budget',
                        min: 12,
                        max: 39,
                        controls: true,
                        inputId: 'budget',
                        inputAttrs: { 'aria-describedby': 'budget-error' },
                        decrementLabel: 'Decrease budget',
                        incrementLabel: 'Increase budget',
                        modelValue: quantity.value,
                        'onUpdate:modelValue': (value) => (quantity.value = value),
                    }),
            ),
        )
        const input = nodes().find((n) => n.type === 'input')!
        expect(input.props.id).toBe('budget')
        expect(input.props['aria-describedby']).toBe('budget-error')
        const buttons = nodes().filter((n) => n.type === 'button')
        expect(buttons.map((n) => n.props['aria-label'])).toEqual([
            'Decrease budget',
            'Increase budget',
        ])
        expect(buttons[0]!.props.disabled).toBe(true)
        quantity.value = 38
        await nextTick()
        ;(buttons[1]!.props.onClick as () => void)()
        await nextTick()
        expect(quantity.value).toBe(39)
        expect(buttons[1]!.props.disabled).toBe(true)
    })
    it('connects tabs and panels and switches without browser animation APIs', async () => {
        const selected = ref('a')
        const nodes = mount(
            defineComponent(
                () => () =>
                    h('main', [
                        h(HTabs, {
                            modelValue: selected.value,
                            items: [
                                { value: 'a', label: 'A' },
                                { value: 'b', label: 'B' },
                            ],
                            idPrefix: 'example',
                            label: 'Example',
                            'onUpdate:modelValue': (value) => (selected.value = value),
                        }),
                        h(
                            HTabPanels,
                            {
                                value: selected.value,
                                order: ['a', 'b'],
                                idPrefix: 'example',
                                animated: false,
                            },
                            { default: ({ value }: { value: string }) => h('p', value) },
                        ),
                    ]),
            ),
        )
        const tabs = nodes().filter((n) => n.props.role === 'tab')
        expect(tabs[0]!.props['aria-controls']).toBe('example-panel-a')
        ;(tabs[1]!.props.onClick as () => void)()
        await nextTick()
        await nextTick()
        const panel = nodes().find((n) => n.props.role === 'tabpanel')!
        expect(panel.props.id).toBe('example-panel-b')
        expect(panel.props['aria-labelledby']).toBe('example-tab-b')
        expect(tabs[1]!.props['aria-selected']).toBe(true)
    })
    it('honors reduced motion before trying the animation API', async () => {
        vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
        const selected = ref('a')
        const nodes = mount(
            defineComponent(
                () => () =>
                    h(
                        HTabPanels,
                        {
                            value: selected.value,
                            order: ['a', 'b'],
                            idPrefix: 'reduced',
                        },
                        { default: ({ value }: { value: string }) => h('p', value) },
                    ),
            ),
        )
        selected.value = 'b'
        await nextTick()
        await nextTick()
        expect(nodes().find((n) => n.props.role === 'tabpanel')!.props.id).toBe('reduced-panel-b')
    })

    it('keeps the no-icon switch API and disabled state', () => {
        const nodes = mount(
            defineComponent(() => () => h(HSwitch, { label: 'Disabled', disabled: true })),
        )
        expect(nodes().filter((n) => n.type === 'img')).toHaveLength(0)
        expect(nodes().find((n) => n.props.role === 'switch')!.props.disabled).toBe(true)
    })
})
