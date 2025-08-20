document.addEventListener("DOMContentLoaded", () => {
  const authContainer = document.getElementById("auth-container");
  const adminView = document.getElementById("admin-view");
  const authButton = document.getElementById("auth-button");
  const secretInput = document.getElementById("admin-secret");
  const logoutButton = document.getElementById("logout-button");

  const storiesContainer = document.getElementById("stories-list-container");
  const paginationContainer = document.getElementById("pagination-container");

  const searchBar = document.getElementById("admin-search-bar");
  const statusFilter = document.getElementById("filter-status");
  const sortSelect = document.getElementById("sort-stories");

  const editModal = document.getElementById("edit-story-modal");
  const closeModalButton = document.getElementById("modal-close-button");
  const cancelEditButton = document.getElementById("cancel-edit-button");
  const editStoryForm = document.getElementById("edit-story-form");
  const saveStoryButton = document.getElementById("save-story-button");

  let adminSecret = "";
  let currentStories = [];

  const state = {
    currentPage: 1,
    storiesPerPage: 10,
    status: "pending",
    search: "",
    sortBy: "created_at",
    sortOrder: "desc",
  };

  const api = {
    getStories: (params) => {
      const query = new URLSearchParams(params).toString();
      return fetch(`/api/admin/stories?${query}`, {
        headers: { "X-Admin-Secret": adminSecret },
      });
    },
    approveStory: (id) =>
      fetch(`/api/admin/stories/${id}/approve`, {
        method: "PATCH",
        headers: { "X-Admin-Secret": adminSecret },
      }),
    updateStory: (id, data) =>
      fetch(`/api/admin/stories/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
        body: JSON.stringify(data),
      }),
    deleteStory: (id) =>
      fetch(`/api/admin/stories/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Secret": adminSecret },
      }),
    deleteComment: (id) =>
      fetch(`/api/admin/comments/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Secret": adminSecret },
      }),
  };

  function checkSession() {
    const savedSecret = sessionStorage.getItem("adminSecretKey");
    if (savedSecret) {
      authenticate(savedSecret);
    }
  }

  function logout() {
    sessionStorage.removeItem("adminSecretKey");
    adminSecret = "";
    adminView.classList.add("hidden");
    authContainer.style.display = "flex";
    secretInput.value = "";
  }

  async function fetchAndRender() {
    storiesContainer.innerHTML =
      '<p style="text-align: center; padding: 2rem;">Loading transmissions...</p>';

    const params = {
      page: state.currentPage,
      limit: state.storiesPerPage,
      status: state.status,
      search: state.search,
      sortBy: state.sortBy.split("-")[0],
      sortOrder: state.sortBy.split("-")[1],
    };

    try {
      const response = await api.getStories(params);
      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Authentication failed. Check secret key.");
        throw new Error(`Failed to fetch stories: ${response.statusText}`);
      }
      const { stories, totalCount } = await response.json();
      currentStories = stories;
      renderStoryRows(stories);
      setupPagination(totalCount);
    } catch (error) {
      storiesContainer.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 2rem;">Error: ${error.message}</p>`;
    }
  }

  function renderStoryRows(stories) {
    storiesContainer.innerHTML = "";
    if (stories.length === 0) {
      storiesContainer.innerHTML =
        '<p style="text-align: center; padding: 2rem;">No transmissions match the current filters.</p>';
      return;
    }

    stories.forEach((story) => {
      const storyWrapper = document.createElement("div");
      storyWrapper.className = "story-entry";

      const row = document.createElement("div");
      row.className = "story-row";
      row.dataset.storyId = story.id;

      const statusText = story.is_approved ? "Approved" : "Pending";
      const statusClass = story.is_approved ? "approved" : "pending";

      row.innerHTML = `
                <div class="col-status">
                    <span class="status-dot ${statusClass}"></span>
                    <span class="status-text">${statusText}</span>
                </div>
                <div class="col-title">
                    <strong>${story.title}</strong>
                    <span>By: ${story.nickname || "N/A"}</span>
                </div>
                <div class="col-location">${story.location_name}</div>
                <div class="col-date">${new Date(
                  story.created_at
                ).toLocaleDateString()}</div>
                <div class="col-actions">
                    ${
                      !story.is_approved
                        ? `<button class="action-btn approve" title="Approve"><i class="fas fa-check-circle"></i></button>`
                        : ""
                    }
                    <button class="action-btn edit" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-btn delete" title="Delete"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;

      const details = document.createElement("div");
      details.className = "story-details";
      details.innerHTML = `
                <div class="details-content">
                    <div class="story-content">
                        <h4>Full Transmission</h4>
                        <div class="full-story-text">${story.full_story}</div>
                    </div>
                    <div class="comments-content">
                        <h4>Comments (${story.comments.length})</h4>
                        <div class="comments-list">
                            ${
                              story.comments.length > 0
                                ? story.comments
                                    .map(
                                      (c) => `
                                <div class="comment-item">
                                    <div class="comment-text">
                                        <p>${c.comment_text}</p>
                                        <div class="comment-meta">By: ${
                                          c.nickname
                                        } | ${new Date(
                                        c.created_at
                                      ).toLocaleString()}</div>
                                    </div>
                                    <button class="action-delete-comment" data-comment-id="${
                                      c.id
                                    }"><i class="fas fa-times"></i></button>
                                </div>
                            `
                                    )
                                    .join("")
                                : "<p>No comments.</p>"
                            }
                        </div>
                    </div>
                </div>
            `;

      storyWrapper.appendChild(row);
      storyWrapper.appendChild(details);
      storiesContainer.appendChild(storyWrapper);
    });
  }

  function setupPagination(totalCount) {
    paginationContainer.innerHTML = "";
    const pageCount = Math.ceil(totalCount / state.storiesPerPage);
    if (pageCount <= 1) return;

    const createButton = (text, page, isDisabled = false, isActive = false) => {
      const button = document.createElement("button");
      button.innerHTML = text;
      button.disabled = isDisabled;
      if (isActive) button.classList.add("active");
      button.addEventListener("click", () => {
        state.currentPage = page;
        fetchAndRender();
      });
      return button;
    };

    paginationContainer.appendChild(
      createButton("«", state.currentPage - 1, state.currentPage === 1)
    );

    for (let i = 1; i <= pageCount; i++) {
      paginationContainer.appendChild(
        createButton(i, i, false, state.currentPage === i)
      );
    }

    paginationContainer.appendChild(
      createButton("»", state.currentPage + 1, state.currentPage === pageCount)
    );
  }

  function handleControlEvents() {
    state.currentPage = 1;
    state.status = statusFilter.value;
    state.search = searchBar.value;
    state.sortBy = sortSelect.value;
    fetchAndRender();
  }

  function openEditModal(storyId) {
    const storyData = currentStories.find((s) => s.id == storyId);
    if (!storyData) return;

    document.getElementById("edit-story-id").value = storyData.id;
    document.getElementById("edit-title").value = storyData.title;
    document.getElementById("edit-nickname").value = storyData.nickname;
    document.getElementById("edit-location").value = storyData.location_name;
    document.getElementById("edit-full-story").value = storyData.full_story;

    editModal.classList.remove("hidden");
  }

  function closeEditModal() {
    editModal.classList.add("hidden");
    editStoryForm.reset();
  }

  async function handleSaveStory(e) {
    e.preventDefault();
    saveStoryButton.disabled = true;
    saveStoryButton.textContent = "Saving...";

    const storyId = document.getElementById("edit-story-id").value;
    const data = {
      title: document.getElementById("edit-title").value,
      nickname: document.getElementById("edit-nickname").value,
      location_name: document.getElementById("edit-location").value,
      full_story: document.getElementById("edit-full-story").value,
    };

    try {
      const response = await api.updateStory(storyId, data);
      if (!response.ok) throw new Error("Failed to save changes.");
      alert("Story updated successfully.");
      closeEditModal();
      await fetchAndRender();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      saveStoryButton.disabled = false;
      saveStoryButton.textContent = "Save Changes";
    }
  }

  storiesContainer.addEventListener("click", async (e) => {
    const storyRow = e.target.closest(".story-row");
    const actionButton = e.target.closest(".action-btn");
    const commentDeleteButton = e.target.closest(".action-delete-comment");

    if (actionButton) {
      const storyId = actionButton.closest(".story-row").dataset.storyId;
      if (actionButton.classList.contains("approve")) {
        if (confirm("Approve this story and make it public?")) {
          const res = await api.approveStory(storyId);
          if (res.ok) fetchAndRender();
          else alert("Failed to approve.");
        }
      } else if (actionButton.classList.contains("edit")) {
        openEditModal(storyId);
      } else if (actionButton.classList.contains("delete")) {
        if (confirm("PERMANENTLY delete this story? This cannot be undone.")) {
          const res = await api.deleteStory(storyId);
          if (res.ok) fetchAndRender();
          else alert("Failed to delete.");
        }
      }
    } else if (commentDeleteButton) {
      const commentId = commentDeleteButton.dataset.commentId;
      if (confirm("Delete this comment?")) {
        const res = await api.deleteComment(commentId);
        if (res.ok) fetchAndRender();
        else alert("Failed to delete comment.");
      }
    } else if (storyRow) {
      storyRow.nextElementSibling.classList.toggle("expanded");
    }
  });

  function authenticate(secret) {
    if (!secret) {
      alert("Please enter the secret key.");
      return;
    }
    adminSecret = secret;
    sessionStorage.setItem("adminSecretKey", secret);

    authContainer.style.display = "none";
    adminView.classList.remove("hidden");

    fetchAndRender();
  }

  authButton.addEventListener("click", () => authenticate(secretInput.value));
  secretInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") authButton.click();
  });

  const debouncedHandler = (() => {
    let timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleControlEvents, 500);
    };
  })();

  searchBar.addEventListener("input", debouncedHandler);
  statusFilter.addEventListener("change", handleControlEvents);
  sortSelect.addEventListener("change", handleControlEvents);

  editStoryForm.addEventListener("submit", handleSaveStory);
  closeModalButton.addEventListener("click", closeEditModal);
  cancelEditButton.addEventListener("click", closeEditModal);

  logoutButton.addEventListener("click", logout);
  checkSession();
});
