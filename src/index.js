import '@/styles/index.scss'
import SinglePage from '@/js/SinglePage'

window.onload = () => {
	// TODO: Add Loader
	new SinglePage({
		threeDctn: document.querySelector("#ctn-three")
	})
}