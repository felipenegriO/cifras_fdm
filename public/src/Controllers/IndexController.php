<?php
class IndexController {
    public function show() {
        require_auth();
        render_view('index');
    }
}
