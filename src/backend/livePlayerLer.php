<?php
if (file_exists('numero.txt')) {
    echo file_get_contents('numero.txt');
} else {
    echo '0';
}
?>