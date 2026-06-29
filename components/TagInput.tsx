'use client'

import { useState, KeyboardEvent } from 'react'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput({ value, onChange, placeholder = 'Type and press Enter' }: Props) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const tag = input.trim().replace(/,+$/, '')
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="border rounded-lg px-3 py-2 flex flex-wrap gap-2 min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500">
      {value.map(tag => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white font-medium"
          style={{ background: 'var(--accent)' }}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:opacity-75 leading-none ml-0.5"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
      />
    </div>
  )
}
