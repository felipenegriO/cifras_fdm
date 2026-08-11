<?php
class EditorController {
    public function showEditor() {
        require_band_role('gestor');
        render_view('editor/editor');
    }

    public function showEditorBeta() {
        require_band_role('gestor');
        render_view('editor/editorbeta');
    }

    public function showPlaylistEditor() {
        require_band_role('gestor');
        render_view('editor/editorplaylist');
    }
}
