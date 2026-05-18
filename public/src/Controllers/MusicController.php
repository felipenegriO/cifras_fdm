<?php
class MusicController {
    public function show() {
        require_auth();
        render_view('music');
    }
}
