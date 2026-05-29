import termkit from "terminal-kit"


main()

function main() {
    const term = termkit.terminal

    term("Press 'q' to trigger the message...\n")

    term.grabInput(true)

    term.on("key", (name: string) => {
        if (name === "q") {
            term("You pressed q!\n")
            term.singleColumnMenu(["opt A", "opt b", "opt c"], {
                keyBindings: {
                    j: "next",
                    k: "previous",
                    ENTER: "submit",
                    q: "cancel",
                }
            })
        }
    })
}

