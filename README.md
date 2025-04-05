# Apex-Indexer-LS

Apex-Indexer-LS is a lightweight Language Server Protocol (LSP) implementation designed to provide symbol indexing and navigation features for Salesforce Apex development. It enables developers to efficiently find definitions, references, and other code insights in Apex projects.

## Features

- **Symbol Indexing**: Quickly index Apex classes, methods, and variables.
- **Go to Definition**: Navigate to the definition of symbols in your code.
- **Find References**: Locate all references to a symbol across your project.
- **Error Reporting**: Identify and report syntax or semantic issues in Apex code.
- **Extensible**: Easily extendable to support additional LSP features.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/apex-indexer-ls.git
   cd apex-indexer-ls
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Usage
To use with Neovim and LSPconfig, add this config to your distro plugin configs. For example, for LazyVim, add the file below to `~/.local/share/nvim/lazy/nvim-lspconfig/lua/lspconfig/configs/apex_indexer_ls.lua`.

```lua
local util = require 'lspconfig.util'

return {
  default_config = {
    filetypes = { 'apexcode' },
    root_dir = util.root_pattern 'sfdx-project.json',
    on_new_config = function(config)
      if not config.cmd then
        config.cmd = {
          'node',
          '/apex-indexer/dist/server.js', --- path to compiled server.js
          '--stdio',
        }
      end
    end,
  },
  docs = {
    description = [[
Test Server
]],
  },
}
```

You also need to configure Neovim. Again, for LazyVim, add the code below to the `LSPconfig.lua` file:

```lua
return {
  "neovim/nvim-lspconfig",
  event = "LazyFile",
  opts = function()
    local util = require("vim.lsp.util") -- LSP utilities
    --[[
    Rest of your LSP config
    --]]

    local ret = {
      servers = {
        apex_indexer_ls = {
          -- Filetypes to attach this LSP to
          filetypes = { "apex", "cls", "trigger" },
          on_attach = function(client, bufnr)
            local function populate_loclist(result)
              local items = {}
              for _, entry in ipairs(result) do
                local uri = entry.uri
                local filename = vim.uri_to_fname(uri)
                table.insert(items, {
                  filename = filename,
                  lnum = entry.range.start.line + 1,
                  col = entry.range.start.character + 1,
                })
              end

              -- Set the location list for the current window
              vim.fn.setloclist(0, items, "r")
              -- Set the title separately
              vim.fn.setloclist(0, {}, "a", { title = "Custom LSP Results" })
            end

            vim.notify("Apex Indexer LSP attached to buffer " .. bufnr, vim.log.levels.INFO)

            -- Helper function to make custom LSP requests ('$/apexIndexer/...')
            local function request_symbol_location(method, action_name)
              vim.notify("Requesting " .. action_name .. "...", vim.log.levels.INFO, { title = "Apex Indexer" })

              -- 1. Get symbol under cursor using Neovim's capability
              local cword = vim.fn.expand("<cword>")
              if not cword or cword == "" then
                vim.notify("No symbol under cursor.", vim.log.levels.WARN, { title = "Apex Indexer" })
                return
              end

              -- 2. Get current document URI and position (required by LSP)
              -- Use 0 for current window, let util handle offset encoding from client capabilities
              local params = util.make_position_params(0, client.offset_encoding)

              -- 3. Construct the custom parameters for our LSP server method
              local custom_params = {
                textDocument = params.textDocument, -- { uri = "file:///..." }
                position = params.position, -- { line = L, character = C } (0-based)
                symbol = cword, -- The identified symbol name
              }

              vim.notify(
                "Sending request '" .. method .. "' for symbol: " .. cword,
                vim.log.levels.DEBUG,
                { title = "Apex Indexer" }
              )

              -- 4. Make the custom LSP request using client.request(method, params, handler, bufnr?)
              --    The handler function receives (err, result)
              client.request(method, custom_params, function(err, result)
                -- Check for errors from the LSP server response
                if err then
                  vim.notify("Apex Indexer Error: " .. vim.inspect(err), vim.log.levels.ERROR)
                  print("[Apex Indexer] Error response for " .. method .. ": ", vim.inspect(err))
                  return
                end

                -- Check if the result is missing or empty
                if not result or vim.tbl_isempty(result) then
                  vim.notify(
                    action_name .. " not found for: " .. cword,
                    vim.log.levels.INFO,
                    { title = "Apex Indexer" }
                  )
                  return
                end

                -- 5. Process the result (which should be an array of LSP Location objects)
                vim.notify("Received " .. #result .. " location(s)", vim.log.levels.INFO, { title = "Apex Indexer" })

                if #result == 1 then
                  -- If only one result, jump directly to that location
                  util.jump_to_location(result[1], client.offset_encoding)
                  vim.cmd("normal! zz") -- Center screen after jump
                else
                  -- If multiple results, populate the location list (buffer-local)
                  populate_loclist(result) -- Call our custom function to populate the location list
                  -- Open the location list window
                  vim.cmd("lopen")
                end
              end, bufnr) -- Associate request with the buffer number
            end

            -- Define buffer-local keymaps for this LSP
            local bufopts = { noremap = true, silent = true, buffer = bufnr, desc = "Apex Indexer" } -- Add description

            -- Map 'gd' (goto definition) to call our custom definition request function
            vim.keymap.set("n", "gld", function()
              request_symbol_location("$/apexIndexer/definitionForSymbol", "Definition")
            end, vim.tbl_extend("force", bufopts, { desc = "Go To Definition (Indexer)" }))

            -- Map 'gr' (goto references) to call our custom reference request function
            vim.keymap.set("n", "glr", function()
              request_symbol_location("$/apexIndexer/referencesForSymbol", "References")
            end, vim.tbl_extend("force", bufopts, { desc = "Find References (Indexer)" }))

            print("[Apex Indexer] Keymaps 'gld' and 'glr' set for buffer.")
          end, -- end on_attach
        }
      }
    }
    return ret
  end,
}

```
