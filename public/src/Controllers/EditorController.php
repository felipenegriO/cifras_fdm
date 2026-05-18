<?php
class EditorController {
    public function showEditor() {
        require_admin();
        render_view('editor/editor');
    }

    public function showEditorBeta() {
        require_admin();
        render_view('editor/editorbeta');
    }

    public function showPlaylistEditor() {
        require_admin();
        render_view('editor/editorplaylist');
    }
}
