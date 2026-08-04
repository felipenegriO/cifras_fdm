<?php
class UsersController {
    public function showEditor() {
        require_auth();
        require_band_role('administrador');
        render_view('users/editoruser');
    }
}
