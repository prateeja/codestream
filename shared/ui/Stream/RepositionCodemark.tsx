import cx from "classnames";
import React, { useState } from "react";
import { connect, useSelector, useDispatch } from "react-redux";
import Icon from "./Icon";
import Button from "./Button";
import { CodemarkPlus, GetRangeScmInfoRequestType } from "@codestream/protocols/agent";
import { HostApi } from "../webview-api";
import { TelemetryRequestType, MoveMarkerRequestType } from "@codestream/protocols/agent";
import { Range, DidChangeWorkspaceFoldersNotification } from "vscode-languageserver-protocol";
import { setCurrentCodemark, repositionCodemark } from "../store/context/actions";
import { CodeStreamState } from "../store";
import { getCurrentSelection } from "../store/editorContext/reducer";
import { getDocumentFromMarker } from "./api-functions";
import { EditorSelectRangeRequestType } from "@codestream/protocols/webview";
import { Codemark } from "./Codemark";

const noop = () => Promise.resolve();

interface Props {
	cancel: Function;
	codemark: CodemarkPlus;
	markerId: string;
}

export const RepositionCodemark = (connect(undefined) as any)((props: Props) => {
	const dispatch = useDispatch();
	const [loading, setLoading] = useState(false);
	const [scm, setScm] = useState();
	const [docMarker, setDocMarker] = useState();

	const reposition = async () => {
		if (!docMarker || !textEditorUri) return;

		setLoading(true);
		let location = "Same File";
		if (textEditorUri !== docMarker.textDocument.uri) location = "Different File";
		HostApi.instance.track("RepositionCodemark", { "New Location": location });
		const scmInfo = await HostApi.instance.send(GetRangeScmInfoRequestType, {
			uri: textEditorUri,
			range: textEditorSelection!
		});
		if (scmInfo && scmInfo.scm) {
			const payload = {
				markerId: props.markerId,
				code: scmInfo.contents,
				range: textEditorSelection,
				documentId: { uri: textEditorUri },
				source: scmInfo.scm
			};
			console.log("Payload: ", payload);
			HostApi.instance.send(MoveMarkerRequestType, payload);
		}
		setLoading(false);
		cancel();
	};

	const textEditorSelection = useSelector((state: CodeStreamState) => {
		return getCurrentSelection(state.editorContext);
	});
	const textEditorUri = useSelector((state: CodeStreamState) => {
		return state.editorContext.textEditorUri;
	});

	const getDocumentMarker = async markerId => {
		try {
			const response = await getDocumentFromMarker(markerId);
			if (response) return setDocMarker(response);
		} catch (error) {
			// TODO:
		}
		return {
			textDocument: "",
			range: undefined,
			marker: undefined
		};
	};

	getDocumentMarker(props.markerId);

	const makeRange = () => {};

	const renderRange = (file, range) => {
		if (!range) {
			return (
				<span className="repo-warning">
					<Icon name="question" /> <b>Unknown</b>
				</span>
			);
		}
		const { start, end } = range;
		const rangeString =
			"" +
			(start.line + 1) +
			":" +
			(start.character + 1) +
			"-" +
			(end.line + 1) +
			":" +
			(end.character + 1);
		return (
			<span className="monospace">
				<Icon name="file" /> {file} <b className="highlight">{rangeString}</b>
			</span>
		);
	};

	const selectPrompt = (
		<span className="info-text">
			<Icon name="info" /> <b>Select a new range to reposition this codemark.</b>
		</span>
	);

	const isRangeDifferent = () => {
		// if we don't know where the
		if (!docMarker) return true;
		const { range, textDocument } = docMarker;
		if (textEditorUri !== textDocument.uri) return true;

		// cursor is at the begging of the codemark range. this is where it starts,
		// so we assume it hasn't been moved
		if (
			textEditorSelection.start.line === range.start.line &&
			textEditorSelection.end.line === range.start.line &&
			textEditorSelection.start.character === 0 &&
			textEditorSelection.end.character === 0
		) {
			return false;
		}

		// same exact range
		if (
			textEditorSelection.start.line === range.start.line &&
			textEditorSelection.end.line === range.end.line &&
			textEditorSelection.start.character === range.start.character &&
			textEditorSelection.end.character === range.end.character
		) {
			return false;
		}

		return true;
	};

	const noSelection = () => {
		if (!textEditorSelection) return true;
		return (
			textEditorSelection.start.line === textEditorSelection.end.line &&
			textEditorSelection.start.character === textEditorSelection.end.character
		);
	};

	const renderNewRange = () => {
		// if (!props.range) return selectPropmpt;
		if (noSelection()) return selectPrompt;
		if (!isRangeDifferent()) return selectPrompt;
		return renderRange(textEditorUri, textEditorSelection);
	};

	const renderMarkerRange = () => {
		if (!docMarker) return null;
		return renderRange(docMarker.textDocument.uri, docMarker.range);
	};

	const cancel = React.useCallback(() => {
		dispatch(setCurrentCodemark());
		// if (codemark) dispatch(repositionCodemark(codemark.id, false));
	}, []);

	return (
		<div id="reposition-blanket">
			<div className="reposition-dialog">
				<form id="reposition-form" className="standard-form">
					<fieldset className="form-body">
						<div id="controls">
							<div className="related" style={{ marginTop: 0 }}>
								<div className="related-label">CURRENT RANGE</div>
								{renderMarkerRange()}
							</div>
							<div className="related">
								<div className="related-label">NEW RANGE</div>
								{renderNewRange()}
							</div>
							<div id="switches" className="control-group">
								<div style={{ display: "none" }} onClick={() => false}>
									<div className={cx("switch", { checked: true })} /> Include replies
								</div>
							</div>
						</div>
						<div
							key="buttons"
							className="button-group"
							style={{
								marginLeft: "10px",
								marginTop: "5px",
								float: "right",
								width: "auto",
								marginRight: 0
							}}
						>
							<Button
								key="cancel"
								style={{
									paddingLeft: "10px",
									paddingRight: "10px",
									width: "auto"
								}}
								className="control-button cancel"
								type="submit"
								onClick={cancel}
							>
								Cancel
							</Button>
							<Button
								key="submit"
								style={{
									paddingLeft: "10px",
									paddingRight: "10px",
									marginRight: 0,
									width: "12em" // fixed width to accomodate spinner
								}}
								className="control-button"
								type="submit"
								loading={loading}
								disabled={!noSelection() && isRangeDifferent() ? false : true}
								onClick={reposition}
							>
								Save New Position
							</Button>
						</div>
					</fieldset>
				</form>
			</div>
		</div>
	);
});
