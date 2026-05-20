<?php
class UsersController {
    /** @param string|null $usersFile kept for backwards-compat but ignored */
    public function __construct($usersFile = null) {}

    public function showEditor() {
        require_auth();
        require_band_role('administrador');
        render_view('users/editoruser');
    }
}
