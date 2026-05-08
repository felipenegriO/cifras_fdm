<?php
class EditorController {
    public function showEditor() {
        require_auth();
        render_view('editor/editor');
    }

    public function showEditorBeta() {
        require_auth();
        render_view('editor/editorbeta');
    }

    public function showPlaylistEditor() {
        require_auth();
        render_view('editor/editorplaylist');
    }
}
