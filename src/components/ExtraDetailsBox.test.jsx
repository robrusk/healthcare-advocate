import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import ExtraDetailsBox from './ExtraDetailsBox'

function Harness({ lang, initial = '' }) {
  const [v, setV] = useState(initial)
  return <ExtraDetailsBox value={v} onChange={setV} lang={lang} />
}

describe('ExtraDetailsBox', () => {
  it('shows the English label and a live counter', async () => {
    render(<Harness />)
    expect(screen.getByLabelText('Anything else we should know? (optional)')).toBeInTheDocument()
    expect(screen.getByText('0 / 2000')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), 'six years')
    expect(screen.getByText('9 / 2000')).toBeInTheDocument()
  })

  it('shows Spanish text when lang is es', () => {
    render(<Harness lang="es" />)
    expect(screen.getByLabelText('¿Algo más que debamos saber? (opcional)')).toBeInTheDocument()
  })

  it('never passes more than 2000 characters up', () => {
    const onChange = vi.fn()
    render(<ExtraDetailsBox value="" onChange={onChange} />)
    const box = screen.getByRole('textbox')
    // simulate a paste that bypasses maxLength
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, 'x'.repeat(2500))
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(onChange.mock.calls.at(-1)[0]).toHaveLength(2000)
  })
})
