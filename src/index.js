import '@/styles/index.sass'
import SinglePage from '@/js/SinglePage'

window.onload = () => {
	new SinglePage({
		threeDctn: document.querySelector("#ctn-three")
	})
}