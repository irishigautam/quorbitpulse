'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write job description…' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    immediatelyRender: false,
  })

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
        {[
          { label: 'B', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
          { label: 'I', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
          { label: 'H2', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
          { label: 'H3', action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), active: editor?.isActive('heading', { level: 3 }) },
          { label: '• List', action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
          { label: '1. List', action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
        ].map(btn => (
          <button
            key={btn.label}
            type="button"
            onMouseDown={e => { e.preventDefault(); btn.action() }}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              btn.active
                ? 'text-white'
                : 'text-gray-600 bg-white border hover:bg-gray-100'
            }`}
            style={btn.active ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="tiptap-editor p-4 min-h-[200px] text-sm focus-within:outline-none"
      />
    </div>
  )
}
