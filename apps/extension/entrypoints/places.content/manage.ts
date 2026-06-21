// Copyright (C) 2026 Index
// Kiln - a quality-of-life browser extension for Polytoria.com
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

const placeID = +window.location.pathname.split("/")[3];

/**
 * Adds a button to the manage page of places allowing users to quickly download their place files from the website.
 */
export function placeFileExport() {
	const container = document.createElement("div");
	container.classList.add("form-group", "mt-4");
	container.innerHTML = `
  <label class="mb-2">
    <h5 class="mb-0">Download <code style="color: orange;">.poly</code> File</h5>
    <small class="text-muted">Quickly download your place from the site!</small>
  </label>
  <br>
  <button type="button" id="_kiln-downloadplace-btn" class="btn btn-primary">Download</button>
  `;

	const form = document.querySelector('form[action="/create/place/update"]')!;
	const button = container.getElementsByTagName("button")[0]!;

	form.insertBefore(container, form.children[form.children.length - 1]);

	button.addEventListener("click", async () => {
		button.innerHTML = `
      <span class="spinner-grow spinner-grow-sm" aria-hidden="true"></span>
        <span class="visually-hidden" role="status">Loading...</span>
    `;

		await sendMessage("downloadPlaceFile", +placeID);

		button.textContent = "Download";
	});
}

/**
 * Adds a card with a textbox where creators can enter a list of line-separated usernames, and whitelist them all at once.
 */
export function bulkWhitelist() {
	const whitelistCard = document.querySelector(
		".card:has(#whitelist-username)",
	)!;

	const bulkWhitelistCard = document.createElement("card");
	bulkWhitelistCard.classList.add("card", "mt-3");
	bulkWhitelistCard.innerHTML = `
	<div class="card-header">
		<i class="fa-duotone fa-solid fa-vial-circle-check"></i>
		Multi-Whitelist
	</div>
	<div class="card-body">
		<textarea class="form-control bg-dark mb-2" placeholder="Usernames (separated by lines).." style="min-height: 250px;"></textarea>
		<button class="btn btn-primary">
			<i class="fa-duotone fa-solid fa-users"></i>
			Whitelist
		</button>
	</div>
	`;
	whitelistCard.parentElement!.appendChild(bulkWhitelistCard);

	const submitBtn = bulkWhitelistCard.getElementsByTagName("button")[0];

	submitBtn.addEventListener("click", async () => {
		const textbox = submitBtn.previousElementSibling! as HTMLTextAreaElement;
		const usernames = textbox.value.split("\n").filter((x) => x.trim() != "");
		textbox.disabled = true;

		if (usernames.length > 0) {
			await sendMessage("bulkWhitelist", {
				placeId: placeID,
				usernames,
			});

			setTimeout(() => {
				window.location.reload();
			}, 200 * usernames.length);
		}
	});
}