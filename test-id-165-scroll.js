// Quick validation script for id 165 double-scroll issue
// Run in browser console on music.php?id=165

const cifraDiv = document.getElementById('cifraWrapper');
if (!cifraDiv) {
  console.error('cifraWrapper not found');
} else {
  console.log('=== ID 165 Scroll Analysis ===');
  console.log('Container overflow-Y:', cifraDiv.style.overflowY);
  console.log('Container scrollHeight:', cifraDiv.scrollHeight);
  console.log('Container clientHeight:', cifraDiv.clientHeight);
  console.log('Has scroll:', cifraDiv.scrollHeight > cifraDiv.clientHeight);
  
  const wrapper = cifraDiv.querySelector('[data-columns-used]');
  if (wrapper) {
    console.log('\nWrapper state:');
    console.log('  scrollHeight:', wrapper.scrollHeight);
    console.log('  clientHeight:', wrapper.clientHeight);
    console.log('  overflow:', window.getComputedStyle(wrapper).overflow);
  }
  
  const body = document.body;
  console.log('\nBody scroll:');
  console.log('  Has vertical scroll:', body.scrollHeight > window.innerHeight);
  console.log('  scrollHeight:', body.scrollHeight);
  console.log('  innerHeight:', window.innerHeight);
}
