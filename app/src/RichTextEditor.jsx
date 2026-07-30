import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Box, IconButton, Divider, Tooltip, Paper } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import TitleIcon from '@mui/icons-material/Title';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useEffect, useRef } from 'react';

const TOOLBAR = [
  { label: '見出し', icon: <TitleIcon fontSize="small" />, action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e) => e.isActive('heading', { level: 2 }) },
  { divider: true },
  { label: '太字', icon: <FormatBoldIcon fontSize="small" />, action: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive('bold') },
  { label: '斜体', icon: <FormatItalicIcon fontSize="small" />, action: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive('italic') },
  { label: '打ち消し線', icon: <FormatStrikethroughIcon fontSize="small" />, action: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive('strike') },
  { label: 'コード', icon: <CodeIcon fontSize="small" />, action: (e) => e.chain().focus().toggleCode().run(), isActive: (e) => e.isActive('code') },
  { divider: true },
  { label: '箇条書き', icon: <FormatListBulletedIcon fontSize="small" />, action: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive('bulletList') },
  { label: '番号付きリスト', icon: <FormatListNumberedIcon fontSize="small" />, action: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive('orderedList') },
  { label: '引用', icon: <FormatQuoteIcon fontSize="small" />, action: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive('blockquote') },
  { divider: true },
  { label: '区切り線', icon: <HorizontalRuleIcon fontSize="small" />, action: (e) => e.chain().focus().setHorizontalRule().run(), isActive: () => false },
  { label: 'リンク', icon: <LinkIcon fontSize="small" />, isLink: true },
  { label: 'リンク解除', icon: <LinkOffIcon fontSize="small" />, action: (e) => e.chain().focus().unsetLink().run(), isActive: () => false },
];

export function RichTextEditor({ value, onChange, placeholder = '説明を入力...', readOnly = false, minHeight = 120 }) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. task switch)
  const lastValueRef = useRef(value);
  useEffect(() => {
    if (!editor || value === lastValueRef.current) return;
    lastValueRef.current = value;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || '', false);
    }
  }, [editor, value]);

  const handleLinkClick = () => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL を入力してください');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
        '& .ProseMirror': {
          p: 1.5,
          minHeight,
          outline: 'none',
          fontSize: '0.875rem',
          lineHeight: 1.7,
          '& p': { my: 0.5 },
          '& h2': { fontSize: '1.05rem', fontWeight: 700, mt: 1.5, mb: 0.5 },
          '& ul, & ol': { pl: 2.5 },
          '& blockquote': { borderLeft: '3px solid', borderColor: 'divider', pl: 1.5, ml: 0, color: 'text.secondary' },
          '& code': { fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 },
          '& pre': { bgcolor: 'action.hover', p: 1.5, borderRadius: 1, overflow: 'auto', '& code': { bgcolor: 'transparent', px: 0 } },
          '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 1.5 },
          '& a': { color: 'primary.main', textDecoration: 'underline' },
          '& .is-editor-empty::before': { content: 'attr(data-placeholder)', color: 'text.disabled', pointerEvents: 'none', position: 'absolute' },
        },
      }}
    >
      {!readOnly && editor && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, px: 0.75, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
            {TOOLBAR.map((item, i) => {
              if (item.divider) return <Divider key={`div-${i}`} orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.5 }} />;
              const active = item.isActive?.(editor) ?? false;
              return (
                <Tooltip key={item.label} title={item.label}>
                  <IconButton
                    size="small"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (item.isLink) { handleLinkClick(); return; }
                      item.action(editor);
                    }}
                    sx={{ borderRadius: 0.75, bgcolor: active ? 'primary.main' : 'transparent', color: active ? 'primary.contrastText' : 'text.secondary', '&:hover': { bgcolor: active ? 'primary.dark' : 'action.selected' } }}
                  >
                    {item.icon}
                  </IconButton>
                </Tooltip>
              );
            })}
          </Box>
        </>
      )}
      <Box sx={{ position: 'relative' }}>
        <EditorContent editor={editor} />
      </Box>
    </Paper>
  );
}
